function doGet(e) {
  var sheet = SpreadsheetApp.openById('').getSheetByName('シート1');
  var rows = sheet.getDataRange().getValues();

  var stats = rows.slice(1)[0];
  var res = [];
  var temp = {};
  temp.avgStep = stats[1];
  temp.maxStep = stats[2];
  temp.distance = stats[3];
  temp.sumStep = stats[4];

  res.push(temp);
  var output = JSON.stringify({ status: 'success', data: res });
  return ContentService.createTextOutput(output).setMimeType(
    ContentService.MimeType.JSON
  );
}
