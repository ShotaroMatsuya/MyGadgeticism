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

function postTweet(mes: string) {
  var service = twitter.getService();
  var endPointUrl = 'https://api.twitter.com/1.1/statuses/update.json';

  var response = service.fetch(endPointUrl, {
    method: 'post',
    payload: {
      status: mes,
    },
  });
}

const CLIENT_ID =
  PropertiesService.getScriptProperties().getProperty('STRAVA_CLIENT_ID')!;
const CLIENT_SECRET = PropertiesService.getScriptProperties().getProperty(
  'STRAVA_CLIENT_SECRET'
)!;

function run() {
  var service = getService();
  if (service.hasAccess()) {
    var url = 'https://www.strava.com/api/v3/athlete/activities';

    var options = {
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken(),
      },
    };
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText())[0];
    Logger.log(result);
  } else {
    var authorizationUrl = service.getAuthorizationUrl();
    Logger.log(
      'Open the following URL and re-run the script: %s',
      authorizationUrl
    );
  }
}

function fetchAPI() {
  var service = getService();
  var url = 'https://www.strava.com/api/v3/athlete/activities';
  var options = {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken(),
    },
  };
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText())[0];

  var activity_type = result.name;
  var distance = (result.distance / 1000).toFixed(2) + 'km';
  var startTime = result.start_date_local;

  var hour =
    Math.floor(result.moving_time / 3600) == 0
      ? 0
      : Math.floor(result.moving_time / 3600);
  var minute = Math.floor((result.moving_time - hour * 3600) / 60);
  var second = result.moving_time - hour * 3600 - minute * 60;
  var runningTime = hour + ' hours' + minute + ' mins' + second + 'secs';

  var average_speed = 1000 / result.average_speed / 60;
  var averageMin = Math.floor(average_speed);
  var averageSec = ('00' + Math.floor((average_speed - averageMin) * 60)).slice(
    -2
  );
  var average = averageMin + ':' + averageSec + '/km';
  if (activity_type == 'Run') {
    //spreadsheetに保存
    const sheet_id =
      PropertiesService.getScriptProperties().getProperty('SS_ID')!;
    var sheet = SpreadsheetApp.openById(sheet_id).getSheetByName('シート1'); // insert Spreadsheet Id and Sheet name
    sheet?.appendRow([
      new Date(),
      activity_type,
      distance,
      startTime,
      runningTime,
      average,
    ]);
  }
}
export function detectDiff() {
  const sheet_id =
    PropertiesService.getScriptProperties().getProperty('SS_ID')!;
  var sheet = SpreadsheetApp.openById(sheet_id).getSheetByName('シート1');
  var cellD1 = sheet?.getRange('D1');
  var before = cellD1?.getValue();

  var service = getService();
  var url = 'https://www.strava.com/api/v3/athlete/activities';
  var options = {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken(),
    },
  };
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText())[0];
  var after = result.start_date_local;

  console.log('更新日時:' + after);
  console.log('前回更新日時' + before);
  if (before != after) {
    console.log('スプレッドシート上書き開始');
    clear();
    fetchAPI();
    var startTime = sheet?.getRange(1, 4).getValue();
    var distance = sheet?.getRange(1, 3).getValue();
    var type = sheet?.getRange(1, 2).getValue();
    var runTime = sheet?.getRange(1, 5).getValue();
    var runSpeed = sheet?.getRange(1, 6).getValue();
    postTweet(
      'Workout Completed! \n Start : ' +
        startTime +
        ' \n Distance : ' +
        distance +
        '\n Duration : ' +
        runTime +
        '\n Speed : ' +
        runSpeed +
        '\n featured by strava'
    );
  } else {
    console.log('スプレッドシート更新なし');
  }
}
function clear() {
  const sheet_id =
    PropertiesService.getScriptProperties().getProperty('SS_ID')!;
  var sheet = SpreadsheetApp.openById(sheet_id).getSheetByName('シート1');
  var lastRow = sheet?.getLastRow()!;
  var lastCol = sheet?.getLastColumn()!;
  sheet?.getRange(1, 1, lastRow, lastCol).clearContent();
}

/**
 * Reset the authorization state, so that it can be re-tested.
 */

function reset() {
  getService().reset();
}

/**
 * Configures the service.
 */
function getService() {
  return (
    // @ts-ignore
    OAuth2.createService('Strava')
      // Set the endpoint URLs.
      .setAuthorizationBaseUrl('http://www.strava.com/oauth/authorize')
      .setTokenUrl('https://www.strava.com/oauth/token')

      // Set the client ID and secret.
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)

      // Set the name of the callback function that should be invoked to
      // complete the OAuth flow.
      .setCallbackFunction('authCallback')

      // Set scope
      .setScope('activity:read_all')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties())
  );
}

/**
 * Handles the OAuth callback.
 */

function authCallback(request: any) {
  var service = getService();
  var authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

/**
 * Logs the redict URI to register.
 */
function logRedirectUri() {
  // @ts-ignore
  Logger.log(OAuth2.getRedirectUri());
}

declare let global: any;
global.detectDiff = detectDiff;
