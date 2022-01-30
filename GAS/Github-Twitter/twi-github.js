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

function detectDiff() {
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1');
  var cellD2 = sheet.getRange('D2');
  var before = cellD2.getValue();
  var after;
  var URL = ''; //github api endpoint
  var res = UrlFetchApp.fetch(URL).getContentText();
  var Json = JSON.parse(res);

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
    var updateTime = sheet.getRange(2, 4).getValue();
    var newRepo = sheet.getRange(2, 3).getValue();
    var type = sheet.getRange(2, 2).getValue();
    var commit = sheet.getRange(2, 5).getValue();
    postTweet(
      'Lightly worked On GitHub \n EventType: ' +
        type +
        ' \n Repository : ' +
        newRepo +
        '\n Commit' +
        commit
    );
  } else {
    console.log('スプレッドシート更新なし');
  }
}
function fetchAPI() {
  var url = ''; //github endpoint url
  var response = UrlFetchApp.fetch(url).getContentText();
  var json = JSON.parse(response);

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

    var sheet = SpreadsheetApp.openById('').getSheetByName('シート1'); // insert Spreadsheet Id and Sheet name
    sheet.appendRow([
      new Date(),
      json[i].type,
      repo,
      json[i].created_at,
      message,
    ]);
  }
}

function clear() {
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  sheet.getRange(2, 1, lastRow, lastCol).clearContent();
}
