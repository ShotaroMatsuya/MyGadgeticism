type affected_location = {
  id: string;
  title: string;
};
type affected_product = {
  id: string;
  title: string;
};
type Status =
  | 'SERVICE_INFORMATION'
  | 'SERVICE_DISRUPTION'
  | 'AVAILABLE'
  | 'SERVICE_OUTAGE';

type incident_json = {
  id: string;
  number: number;
  begin: Iso8601;
  end?: Iso8601;
  created: Iso8601;
  modified: Iso8601;
  external_desc: string;
  updates: each_incident[];
  most_recent_update: each_incident;
  status_impact: Status;
  severity: string;
  service_key: string;
  affected_products: affected_product[];
  uri: string;
  currently_affected_locations: affected_location[];
  previously_affected_locations: affected_location[];
};

type each_incident = {
  created: Iso8601;
  modified: Iso8601;
  when: Iso8601;
  text: string;
  status: Status;
  affected_locations: affected_location[];
};

type Phantomic<T, U extends string> = T & { [key in U]: never };
type Iso8601 = Phantomic<string, 'Iso8601'>;

const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{2}:\d{2}$/;

export function doGet(): void {
  getIncidents();
}
function getIncidents(): void {
  const url = PropertiesService.getScriptProperties().getProperty(
    'GCP_HEATH_DASHBOARD_JSON_PATH'
  )!;
  const res = UrlFetchApp.fetch(url).getContentText();
  const json: incident_json[] = JSON.parse(res);
  let count = 0;
  for (let obj of json) {
    // 回数制限(最新100件のみ)
    if (count > 100) {
      break;
    }
    count += 1;
    let current_affected_location_idx = -1,
      previously_affected_locations_idx = -1;
    if (obj.currently_affected_locations.length > 0) {
      current_affected_location_idx =
        obj.currently_affected_locations.findIndex(
          (el: affected_location) =>
            el.id === 'asia-northeast1' ||
            el.id === 'nam5' ||
            el.id === 'global'
        );
    }
    if (obj.previously_affected_locations.length > 0) {
      previously_affected_locations_idx =
        obj.previously_affected_locations.findIndex(
          (el: affected_location) =>
            el.id === 'asia-northeast1' ||
            el.id === 'nam5' ||
            el.id === 'global'
        );
    }
    if (
      current_affected_location_idx < 0 &&
      previously_affected_locations_idx < 0
    ) {
      continue;
    }

    const is_affected_service = obj.affected_products.findIndex(
      (el: affected_product) => el.title === 'Cloud Firestore'
    );
    if (is_affected_service < 0) {
      continue;
    }
    console.log(obj.id, 'is affected incident');
    // compare info
    const targetIdx = checkUpdate(obj);
    if (targetIdx >= -1) {
      console.log('Detected difference in spreadsheet');
      // update info
      const item = updateInfo(obj, targetIdx);
      console.log(item);
      // post to slack ch
      postToSlack(item);
    } else {
      console.log('Not found difference');
    }
  }
}

function checkUpdate(obj: incident_json): number {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('firestore');
  const lastRow = sheet?.getDataRange().getLastRow() || 0;
  // header only case in ss, then insert this
  if (lastRow === 1) return -1;
  const values = sheet?.getRange(2, 1, lastRow - 1, 13).getValues();
  const idx = values?.findIndex(v => v[0] === obj.id)!;
  console.log(idx);
  if (idx > -1 && values !== undefined) {
    // found old data in ss, then update conditionally
    return values[idx][1] !==
      Utilities.formatDate(
        new Date(obj.modified),
        'JST',
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      )
      ? idx
      : -2;
  } else {
    // not found in ss ,then insert this
    return -1;
  }
}

function updateInfo(obj: incident_json, index: number) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('firestore');

  const updated_at = Utilities.formatDate(
    new Date(obj.modified),
    'JST',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  ); // col:B
  const created_at = Utilities.formatDate(
    new Date(obj.created),
    'JST',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  ); // col:C
  const abstract = obj.external_desc; // col: D
  const fullText = obj.most_recent_update.text;
  const text =
    fullText.length > 3000 ? fullText.slice(0, 2950) + ' [...]' : fullText; // col: E
  const status = obj.most_recent_update.status; // col:  F
  const severity = obj.severity; // col: G
  const affected_services = obj.affected_products.map(el => el.title); // col: H
  const currently_affected_locations_arr = obj.currently_affected_locations.map(
    el => el.id
  );
  const previously_affected_locations_arr =
    obj.previously_affected_locations.map(el => el.id);
  const affected_locations = Array.from(
    new Set([
      ...currently_affected_locations_arr,
      ...previously_affected_locations_arr,
    ])
  ); // col: I
  const uri = obj.uri; // col: J
  const opened_at = Utilities.formatDate(
    new Date(obj.begin),
    'JST',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  ); // col: K
  const closed_at = obj.end
    ? Utilities.formatDate(new Date(obj.end), 'JST', "yyyy-MM-dd'T'HH:mm:ssXXX")
    : 'No Information'; // col: L

  const newData: string[] = [
    obj.id,
    updated_at,
    created_at,
    abstract,
    text,
    status,
    severity,
    affected_services.join(),
    affected_locations.join(),
    uri,
    opened_at,
    closed_at,
    Utilities.formatDate(new Date(), 'JST', "yyyy-MM-dd'T'HH:mm:ssXXX"),
  ];
  console.log(newData);
  if (index === -1) {
    // insert
    sheet?.appendRow(newData);
  } else if (index > -1) {
    // update
    const targetLine = index + 2;
    sheet?.getRange(targetLine, 1, 1, 13).setValues([newData]);
  }
  return newData;
}

function postToSlack(data: string[]) {
  const [
    id,
    updated_at,
    created_at,
    abstract,
    text,
    status,
    severity,
    affected_services,
    affected_locations,
    uri,
    opened_at,
    closed_at,
    executed_at,
  ] = data;
  const postUrl =
    PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL')!;
  const channelId =
    PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID')!;
  const userName = 'FireStore障害通知';
  const icon = ':gcp-logo-pop:';
  let color = '';
  // statusに応じて色を変える
  switch (status) {
    case 'SERVICE_DISRUPTION':
      color = '#FFFF00'; // yellow
      break;
    case 'AVAILABLE':
      color = '#32CD32'; //green
      break;
    case 'SERVICE_INFORMATION':
      color = '#0000FF'; //blue
      break;
    case 'SERVICE_OUTAGE':
      color = 'FF0000'; //red
      break;
    default: //gray
      color = '#D3D3D3';
      break;
  }
  const jsonData = {
    username: userName,
    icon_emoji: icon,
    channel: channelId,
    text: `[${severity}]FireStore Status Dashboard Updates(id=${id})`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `[${severity}]FireStore Status Dashboard Updates(${updated_at})`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${abstract}*`,
        },
      },
    ],
    attachments: [
      {
        color: color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Text:* ${text}`,
            },
            accessory: {
              type: 'image',
              image_url:
                'https://brandslogos.com/wp-content/uploads/images/large/firebase-logo.png',
              alt_text: 'firestore-logo image',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Opened Time:*\n${opened_at}`,
              },
              {
                type: 'mrkdwn',
                text: `*Closed Time:*\n${closed_at}`,
              },
              {
                type: 'mrkdwn',
                text: `*Affected Services:* \n${affected_services}`,
              },
              {
                type: 'mrkdwn',
                text: `*Affected Locations:* \n${affected_locations}`,
              },
            ],
          },
          {
            type: 'actions',
            block_id: 'actionblock790',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Detail',
                },
                style: 'primary',
                url: `https://status.cloud.google.com/${uri}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                image_url:
                  'https://www.sophos.com/sites/default/files/2022-02/googlecloud.png',
                alt_text: 'gcp',
              },
              {
                type: 'mrkdwn',
                text: `<!date^${Math.floor(
                  Date.now() / 1000
                )}^{date_pretty} at {time}|Posted>`,
              },
            ],
          },
        ],
      },
    ],
  };

  const payload = JSON.stringify(jsonData);
  // Slackに通知する
  UrlFetchApp.fetch(postUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
  });
}

declare let global: any;
global.doGet = doGet;
