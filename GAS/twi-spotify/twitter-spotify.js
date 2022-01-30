// init twitter API

const twitter = TwitterWebService.getInstance(
  '', //twitter API Key
  '' //twitter API Secret Key
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

//init spotify API

function sendTopGenreToTwitter() {
  // ******************
  // ここから下を個別に設定 (spotify api credentials)
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
  const genres = getTopArtists(access_token, basic_authorization);
  if (typeof genres !== 'undefined' && genres.length !== 0) {
    const message =
      'The hottest Genre for me this week \n 1st :' +
      genres[0][0] +
      '\n 2nd :' +
      genres[1][0] +
      '\n 3rd :' +
      genres[2][0] +
      '\n 4th :' +
      genres[3][0] +
      '\n 5th :' +
      genres[4][0] +
      '\n featured by spotifyAPI';
    console.log(message);
    postTweet(message);
  } else {
    console.log('genre is empty!!');
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
// 再生数上位3曲のアーティストのGenreを取得
function getTopArtists(access_token, basic_authorization) {
  const artistIds = [];
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
      console.log('アーティストを取得');
      for (let i = 0; i < 50; i++) {
        for (let j = 0; j < parsedResponse.items[i].artists.length; j++) {
          artistIds.push(parsedResponse.items[i].artists[j].id);
        }
      }
      console.log(artistIds); //配列をgetTopGenresにわたす
      return getTopGenres(artistIds, access_token, basic_authorization);
    case 401:
      console.log('access_tokenが切れた1');
      const refreshed_access_token =
        refreshAccessTokenToSpotify(basic_authorization);
      return getTopArtists(refreshed_access_token, basic_authorization);
    default:
      console.log(response.getResponseCode());
      console.log('実行されない想定1');
  }
}

function getTopGenres(artists, access_token, basic_authorization) {
  const options = {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + access_token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true, // 401エラーへの対応
  };
  let genresArr = [];
  artists.forEach(artist => {
    const response = UrlFetchApp.fetch(
      'https://api.spotify.com/v1/artists/' + artist,
      options
    );
    switch (response.getResponseCode()) {
      case 200:
        const parsedResponse = JSON.parse(response);
        console.log('Genreを取得');
        parsedResponse.genres.forEach(genre => {
          genresArr.push(genre);
        });
        return genresArr;
      case 401:
        console.log('access_tokenが切れた2');
        const refreshed_access_token =
          refreshAccessTokenToSpotify(basic_authorization);
        return getTopGenres(
          artists,
          refreshed_access_token,
          basic_authorization
        );
      default:
        console.log('実行されない想定2');
    }
  });
  genresArr = genresArr.filter(v => {
    return !v.match(/pop/g); //popという文字列を部分一致で除外する
  });
  //  genresArr = genresArr.filter(v => {
  //    if(v.match(/pop/g) || v.match(/house/g)){
  //      return false;
  //    }
  //    return true;
  //  });
  console.log(genresArr);
  genresArr = arrayDuplicateCount(genresArr);
  return genresArr;
}
//
function arrayDuplicateCount(resultsArr) {
  let counts = resultsArr.reduce((prev, current) => {
    prev[current] = (prev[current] || 0) + 1;
    return prev;
  }, {});
  console.log(counts); // {'edm': 1,'pop' : 4, 'uk-rock':3}
  // count順にソート
  let pairs = Object.entries(counts);
  //  console.log(pairs);//[['pop',4],['uk pop', 4],['talent show', 2]]
  pairs = pairs
    .filter(v => v[1] < 5)
    .slice()
    .sort((p1, p2) => {
      let p1Val = p1[1],
        p2Val = p2[1];
      if (p1Val - p2Val > 0) {
        return -1;
      } else {
        return 1;
      }
    });
  //  counts = Object.fromEntries(pairs); // {pop: 4,'uk pop': 4,'talent show': 2,'dance pop': 2,'post-teen pop': 2}
  return pairs;
}

//function sortedArrayToUnique(resultsArr){
//  let sortedArr = Array.from(new Set(resultsArr)).sort();
//  console.log(sortedArr);
//}
