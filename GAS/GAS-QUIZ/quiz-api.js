function doGet(e) {
  var ss = SpreadsheetApp.openById('スプレッドシートid');
  var sheet = ss.getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  Logger.log(rows);
  var questions = rows.slice(1);
  var res = [];
  questions.forEach(function (info) {
    var temp = {};
    temp.question = info[0];
    temp.answer = info[1];
    temp.opt = [];
    for (var x = 1; x < info.length; x++) {
      if (info[x].length > 0) {
        temp.opt.push(info[x]);
      }
    }
    res.push(temp);
  });
  var output = JSON.stringify({
    status: 'success',
    data: res,
  });
  return ContentService.createTextOutput(output).setMimeType(
    ContentService.MimeType.JSON
  );
}
