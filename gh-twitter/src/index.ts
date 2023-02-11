const twitter_api_key =
  PropertiesService.getScriptProperties().getProperty('TWITTER_API_KEY');
const twitter_secret_key =
  PropertiesService.getScriptProperties().getProperty('TWITTER_SECRET_KEY');

// init twitter API
// @ts-ignore
const twitter = TwitterWebService.getInstance(
  twitter_api_key, //API Key
  twitter_secret_key // API Secret Key
)!;

//アプリを連携認証する
function authorize() {
  twitter.authorize();
}

//認証を解除する
function reset() {
  twitter.reset();
}

//認証後のコールバック
function authCallback(request: any) {
  return twitter.authCallback(request);
}
function postTweet(mes: any) {
  var service = twitter.getService();
  var endPointUrl = 'https://api.twitter.com/1.1/statuses/update.json';

  var response = service.fetch(endPointUrl, {
    method: 'post',
    payload: {
      status: mes,
    },
  });
}

export function detectDiff() {
  const spread_sheet_id =
    PropertiesService.getScriptProperties().getProperty('SS_ID')!;
  const client_id =
    PropertiesService.getScriptProperties().getProperty('GITHUB_CLIENT_ID')!;
  const client_secret = PropertiesService.getScriptProperties().getProperty(
    'GITHUB_CLIENT_SECRET'
  )!;

  var sheet =
    SpreadsheetApp.openById(spread_sheet_id).getSheetByName('シート1');
  var cellD2 = sheet?.getRange('D2');
  var before = cellD2?.getValue();
  var after;
  var URL = `https://api.github.com/users/ShotaroMatsuya/events/public?client_id=${client_id}&client_secret=${client_secret}`;
  var res = UrlFetchApp.fetch(URL);
  var Json = JSON.parse(res.toString());

  for (var i = 0; i < 10; i++) {
    if (Json[i].type != 'PushEvent' && Json[i].type != 'CreateEvent') {
      continue;
    } else {
      after = Json[i].created_at;
      break;
    }
  }

  console.log('更新日時:' + after);
  console.log('前回更新日時' + before);
  if (before != after) {
    console.log('スプレッドシート上書き開始');
    clear();
    fetchAPI();
    var updateTime = sheet?.getRange(2, 4).getValue();
    var newRepo = sheet?.getRange(2, 3).getValue();
    var type = sheet?.getRange(2, 2).getValue();
    var commit = sheet?.getRange(2, 5).getValue();
    postTweet(
      'Lightly worked On GitHub \n EventType: ' +
        type +
        ' \n Repository : ' +
        newRepo +
        '\n ' +
        commit
    );
  } else {
    console.log('スプレッドシート更新なし');
  }
}
function fetchAPI() {
  const spread_sheet_id =
    PropertiesService.getScriptProperties().getProperty('SS_ID')!;
  const client_id =
    PropertiesService.getScriptProperties().getProperty('GITHUB_CLIENT_ID')!;
  const client_secret = PropertiesService.getScriptProperties().getProperty(
    'GITHUB_CLIENT_SECRET'
  )!;
  var url = `https://api.github.com/users/ShotaroMatsuya/events/public?client_id=${client_id}&client_secret=${client_secret}`;
  var response = UrlFetchApp.fetch(url);
  var json = JSON.parse(response.toString());

  for (var i = 0; i < 10; i++) {
    var message = '';
    var repo = '';
    if (json[i].type != 'PushEvent' && json[i].type != 'CreateEvent') {
      continue;
    } else if (json[i].type == 'CreateEvent') {
      repo = json[i].repo.name.slice(15);
      message = 'create :' + repo;
    } else {
      repo = json[i].repo.name.slice(15);
      message = 'commit :' + json[i].payload.commits[0].message;
    }

    var sheet =
      SpreadsheetApp.openById(spread_sheet_id).getSheetByName('シート1'); // insert Spreadsheet Id and Sheet name
    sheet?.appendRow([
      new Date(),
      json[i].type,
      repo,
      json[i].created_at,
      message,
    ]);
  }
}

function clear() {
  const spread_sheet_id =
    PropertiesService.getScriptProperties().getProperty('SS_ID')!;
  var sheet =
    SpreadsheetApp.openById(spread_sheet_id).getSheetByName('シート1');
  var lastRow = sheet?.getLastRow()!;
  var lastCol = sheet?.getLastColumn()!;
  sheet?.getRange(2, 1, lastRow, lastCol).clearContent();
}

declare let global: any;
global.detectDiff = detectDiff;
