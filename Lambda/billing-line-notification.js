const https = require('https');
const AWS = require('aws-sdk');

/**
 * LINEでPushメッセージを送信する
 */
const LINEMessage = (() => {
  let _postData = '';
  let _message = '';
  let _requestBody = new Object();

  const setMessage = data => {
    _message = String(`今月のAWS概算請求金額は「${data}$」です。`);
    _requestBody.to = process.env.LINE_USER_ID;
    _requestBody.messages = [{ type: 'text', text: _message }];
    _postData = JSON.stringify(_requestBody);
  };

  const pushMessage = () => {
    return new Promise(resolve => {
      //setMessageの使用を強制させる
      if (_postData === '') {
        console.log('setMessageの使用が必要です');
        return;
      }
      const headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(_postData),
      };

      const _options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: headers,
      };

      const req = https.request(_options, res => {
        console.log('statusCode:', res.statusCode);
        res.on('end', () => {
          resolve(true);
        });
      });

      req.on('error', e => {
        console.error(e);
      });

      req.write(_postData);
      req.end();
    });
  };
  return {
    pushMessage: pushMessage,
    setMessage: setMessage,
  };
})();

/**
 * AWSから請求金額を取得する
 */
const FechAWSBilling = (() => {
  const cw = new AWS.CloudWatch({ region: 'us-east-1' });
  const date = new Date();
  const endTime = date.toISOString();
  date.setDate(date.getDate() - 1);
  const startTime = date.toISOString();

  const params = {
    StartTime: startTime,
    EndTime: endTime,
    MetricName: 'EstimatedCharges',
    Namespace: 'AWS/Billing',
    Period: 86400,
    Dimensions: [
      {
        Name: 'Currency',
        Value: 'USD',
      },
    ],
    Statistics: ['Maximum'],
  };

  const getMetricStatistics = async () => {
    return new Promise(resolve => {
      cw.getMetricStatistics(params, (err, data) => {
        if (err) {
          console.log(err, err.stack);
        }
        resolve(data);
      });
    });
  };
  return {
    getMetricStatistics: getMetricStatistics,
  };
})();

exports.handler = async () => {
  const bill = await FechAWSBilling.getMetricStatistics();
  console.log(bill);
  LINEMessage.setMessage(bill.Datapoints[0].Maximum);
  const pushComplete = await LINEMessage.pushMessage();
  if (pushComplete) {
    console.log('関数は正常に実行されました。');
    return;
  }
};
