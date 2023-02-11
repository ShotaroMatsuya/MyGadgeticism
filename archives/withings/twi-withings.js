//init twitter API
//認証用インスタンスの生成
var twitter = TwitterWebService.getInstance(
  '', //API Key
  '' //API secret key
);

//アプリを連携認証する
function authorize() {
  twitter.authorize();
}

//認証を解除する
function reset() {
  twitter.reset();
}

//認証後のコールバック
function authCallback(request) {
  return twitter.authCallback(request);
}
function postTweet(mes) {
  var service = twitter.getService();
  var endPointUrl = 'https://api.twitter.com/1.1/statuses/update.json';

  var response = service.fetch(endPointUrl, {
    method: 'post',
    payload: {
      status: mes,
    },
  });
}

// enter the withings api credentials
var CLIENT_ID = '';
var CLIENT_SECRET = '';

/**
 * Authorizes and makes a request to the Withings API.
 */
function run() {
  var service = getService();
  if (service.hasAccess()) {
    var url = 'https://wbsapi.withings.net/v2/measure';

    var today = new Date();
    var oneWeekAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6
    );

    var nowDate = formatDate(today, 'YYYY-MM-DD');
    var pastDate = formatDate(oneWeekAgo, 'YYYY-MM-DD');
    Logger.log(nowDate);
    Logger.log(pastDate);
    var options = {
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken(),
      },
      payload: {
        action: 'getactivity',
        startdateymd: pastDate,
        enddateymd: nowDate,
        data_fields: 'steps',
      },
    };
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText()).body.activities;
    Logger.log(JSON.stringify(result));
  } else {
    var authorizationUrl = service.getAuthorizationUrl();
    Logger.log(
      'Open the following URL and re-run the script: %s',
      authorizationUrl
    );
  }
}
function updateData() {
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1');
  var cellB2 = sheet.getRange('B2');
  var before = cellB2.getValue();
  clear();
  var newStats = fetchAPI();
  var after = newStats.average;
  var max = newStats.max;
  var distance = newStats.distance;
  var steps = newStats.steps;
  var mes = '';

  if (before > after) {
    mes = 'Less than last week ...';
  } else if (before < after) {
    mes = 'More than last week !!!';
  } else {
    mes = 'Miraculously the same number of steps';
  }
  Logger.log(mes);

  postTweet(
    'Distance :' +
      distance +
      'km \n Maximum :' +
      max +
      'steps \n Average :' +
      after +
      'steps \n' +
      mes +
      '\n featured by withings API'
  );
}
function fetchAPI() {
  var service = getService();
  var url = 'https://wbsapi.withings.net/v2/measure';

  var today = new Date();
  var oneWeekAgo = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 7
  );

  var nowDate = formatDate(today, 'YYYY-MM-DD');
  var pastDate = formatDate(oneWeekAgo, 'YYYY-MM-DD');
  Logger.log(nowDate);
  Logger.log(pastDate);
  var options = {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken(),
    },
    payload: {
      action: 'getactivity',
      startdateymd: pastDate,
      enddateymd: nowDate,
      data_fields: 'steps,distance',
    },
  };
  var response = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(response.getContentText()).body.activities;
  //Logger.log(JSON.stringify(result));
  var sumSteps = 0;
  var max = 0;
  var sumDis = 0;
  for (var i = 0; i < result.length; i++) {
    sumSteps += result[i].steps;
    sumDis += result[i].distance;
    if (max < result[i].steps) {
      max = result[i].steps;
    }
  }
  sumDis = Math.round(sumDis / 1000);

  var averageSteps = Math.round(sumSteps / 7);
  var obj = {
    average: averageSteps,
    max: max,
    distance: sumDis,
    steps: sumSteps,
  };
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1'); // insert Spreadsheet Id and Sheet name
  sheet.appendRow([new Date(), averageSteps, max, sumDis, sumSteps]);
  return obj;
}

function clear() {
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  sheet.getRange(2, 1, lastRow, lastCol).clearContent();
}

function formatDate(date, format) {
  format = format.replace(/YYYY/, date.getFullYear());
  format = format.replace(/MM/, ('00' + (date.getMonth() + 1)).slice(-2));
  format = format.replace(/DD/, ('00' + date.getDate()).slice(-2));

  return format;
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
    OAuth2.createService('Withings')
      // Set the endpoint URLs.
      .setAuthorizationBaseUrl(
        'https://account.withings.com/oauth2_user/authorize2'
      )
      .setTokenUrl('https://account.withings.com/oauth2/token')

      // Set the client ID and secret.
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)

      // Set the name of the callback function that should be invoked to
      // complete the OAuth flow.
      .setCallbackFunction('authCallback')

      // Set scope
      .setScope('user.activity')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties())
  );
}

/**
 * Handles the OAuth callback.
 */
function authCallback(request) {
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
  Logger.log(OAuth2.getRedirectUri());
}
