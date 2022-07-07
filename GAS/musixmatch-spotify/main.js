// init twitter API

const twitter = TwitterWebService.getInstance(
  '', //API Key
  '' // API Secret Key
);

// アプリを連携認証
function authorize() {
  twitter.authorize();
}

// 認証を解除する
function reset() {
  twitter.reset();
}

function authCallback(request) {
  return twitter.authCallback(request);
}

function postTweet(mes) {
  const service = twitter.getService();
  const endPointUrl = 'https://api.twitter.com/1.1/statuses/update.json';
  const response = service.fetch(endPointUrl, {
    method: 'post',
    payload: {
      status: mes,
    },
  });
}

// ここに過激ワードを追加
const sensitiveWordsMappingList = {
  kill: 'kxll',
  fuck: 'fxxk',
};

// init spotify API

function sendTopSongsSnipetToTwitter() {
  // ******************
  // ここから下を個別に設定
  const client_id = '';
  const client_secret = '';
  const authorization_code = '';
  const basic_authorization = Utilities.base64Encode(
    client_id + ':' + client_secret
  ); // 変更不要
  // ここから上を個別に設定
  // ******************
  // Spotify へのアクセストークンを取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const is_first_access =
    Object.keys(scriptProperties.getProperties()).length == 0;
  const access_token = is_first_access
    ? getFirstAccessTokenToSpotify(authorization_code, basic_authorization)
    : scriptProperties.getProperty('access_token');
  const lyricsArray = getFavoriteSnippets(access_token, basic_authorization);
  let extractSnippets = [];
  if (typeof lyricsArray === 'object') {
    for (let i = 0; i < 3; i++) {
      extractSnippets.push(
        ...lyricsArray.splice(Math.floor(Math.random() * lyricsArray.length), 1)
      );
    }
    console.log(extractSnippets);
  } else {
    return;
  }
  // sanitize words
  const sanitizedArray = extractSnippets.map(word =>
    sanitizeSensitiveWords(word)
  );

  if (typeof sanitizedArray !== 'undefined' && sanitizedArray.length !== 0) {
    const message =
      '🤯 The Randomly fetched snippets of the music I heard the most this week. \n\n 🎙️ < ' +
      sanitizedArray[0] +
      '\n 🎶 < ' +
      sanitizedArray[1] +
      '\n 🤬 < ' +
      sanitizedArray[2] +
      '\n\n featured by musixmatch API';
    console.log(message);
    postTweet(message);
  } else {
    console.log('array is empty!!');
  }
}

function getFirstAccessTokenToSpotify(authorization_code, basic_authorization) {
  const headers = { Authorization: 'Basic ' + basic_authorization };
  const payload = {
    grant_type: 'authorization_code',
    code: authorization_code,
    redirect_uri: 'https://example.com/callback',
  };
  const options = {
    payload: payload,
    headers: headers,
  };
  const response = UrlFetchApp.fetch(
    'https://accounts.spotify.com/api/token',
    options
  );

  const parsedResponse = JSON.parse(response);
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperties({
    access_token: parsedResponse.access_token,
    refresh_token: parsedResponse.refresh_token,
  });
  return parsedResponse.access_token;
}

function refreshAccessTokenToSpotify(basic_authorization) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const refresh_token = scriptProperties.getProperty('refresh_token');

  const headers = {
    Authorization: 'Basic ' + basic_authorization,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const payload = {
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
  };
  const options = {
    payload: payload,
    headers: headers,
  };
  const response = UrlFetchApp.fetch(
    'https://accounts.spotify.com/api/token',
    options
  );

  const parsedResponse = JSON.parse(response);
  scriptProperties.setProperty('access_token', parsedResponse.access_token);
  // refresh_tokenは毎回発行されるとは限らない
  if (parsedResponse.refresh_token) {
    scriptProperties.setProperty('refresh_token', parsedResponse.refresh_token);
  }
  return parsedResponse.access_token;
}

// 再生数上位5曲の曲情報の取得
function getFavoriteSnippets(access_token, basic_authorization) {
  const topSongs = [];

  const options = {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + access_token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true, // 401エラーへの対応
  };
  const response = UrlFetchApp.fetch(
    'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50&offset=0',
    options
  );

  switch (response.getResponseCode()) {
    case 200:
      const parsedResponse = JSON.parse(response);
      console.log('曲を取得');
      const songMap = new Map(
        parsedResponse.items.map(song => {
          return [song.name, song.artists[0].name];
        })
      );
      const lyricsArr = getSnippetsArr(songMap);

      return lyricsArr;
    case 401:
      console.log('access_tokenが切れた1');
      const refreshed_access_token =
        refreshAccessTokenToSpotify(basic_authorization);
      return getFavoriteSnippets(refreshed_access_token, basic_authorization);
    default:
      console.log(response.getResponseCode());
      console.log('実行されない想定');
  }
}
// musixmatch API
const apikey = '';
// track_idを取得 (from musixmatch)
function getSnippetsArr(map) {
  let snippetsArr = [];
  const baseUrl = `https://api.musixmatch.com/ws/1.1/track.search?apikey=${apikey}`;
  const options = {
    method: 'get',
  };
  for (let [songName, artistName] of map.entries()) {
    const params = `&q_track=${songName}&q_artist=${artistName}&f_has_lyrics=true&page=1`;
    const response = UrlFetchApp.fetch(baseUrl + params);
    if (response.getResponseCode() !== 200) {
      console.log('musixmatch API(track search)更新失敗');
      break;
    }
    const parsedResponse = JSON.parse(response);
    if (typeof parsedResponse.message.body.track_list[0] !== 'undefined') {
      const snippet = getSnipets(
        parsedResponse.message.body.track_list[0].track.track_id
      );
      if (snippet !== '') {
        snippetsArr.push(snippet);
      }
    }
  }
  return snippetsArr;
}

// snipetsを取得
function getSnipets(track_id) {
  const url = `https://api.musixmatch.com/ws/1.1/track.snippet.get?apikey=${apikey}&track_id=${track_id}`;
  const response = UrlFetchApp.fetch(url);
  if (response.getResponseCode() === 200) {
    const parsedResponse = JSON.parse(response);
    return parsedResponse.message.body.snippet.snippet_body;
  } else {
    console.log('musixmatch API(get snippet)更新失敗');
    return '';
  }
}

// sanitize words
function sanitizeSensitiveWords(word) {
  const sanitizeMap = new Map(Object.entries(sensitiveWordsMappingList));
  for ([before, after] of sanitizeMap.entries()) {
    let reg = new RegExp('(' + before + ')', 'gi');
    if (reg.test(word)) {
      console.log('sanitize実行!');
      return word.replace(reg, after);
    }
  }
  console.log('sanitize不要');
  return word;
}
