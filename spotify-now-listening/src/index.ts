export function setSlackStatusFromSpotifyApp() {
  // ******************
  // ここから下を個別に設定
  const client_id = PropertiesService.getScriptProperties().getProperty(
    'SPOTIFY_API_CLIENT_ID'
  )!;
  const client_secret = PropertiesService.getScriptProperties().getProperty(
    'SPOTIFY_API_CLIENT_SECRET'
  )!;
  const authorization_code =
    PropertiesService.getScriptProperties().getProperty(
      'SPOTIFY_API_AUTHORIZATION_CODE'
    )!;
  const slack_user_id =
    PropertiesService.getScriptProperties().getProperty('SLACK_USER_ID')!;
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

  // 聞いている曲を Slack の Status へ反映
  const now_playing = getNowPlaying(access_token, basic_authorization);
  console.log(now_playing);
  switch (now_playing) {
    case null: // 何も聞いていない
      setSlackStatus(slack_user_id, '', '');
      console.log('何も聞いていない');
      break;
    default: // now listening
      setSlackStatus(slack_user_id, now_playing, '');
      console.log('now listening');
      break;
  }
}

function getFirstAccessTokenToSpotify(
  authorization_code: string,
  basic_authorization: string
) {
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

  const parsedResponse = JSON.parse(response.toString());
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperties({
    access_token: parsedResponse.access_token,
    refresh_token: parsedResponse.refresh_token,
  });
  return parsedResponse.access_token;
}

function refreshAccessTokenToSpotify(basic_authorization: string) {
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

  const parsedResponse = JSON.parse(response.toString());
  scriptProperties.setProperty('access_token', parsedResponse.access_token);
  // refresh_token は毎回発行されるとは限らない
  if (parsedResponse.refresh_token) {
    scriptProperties.setProperty('refresh_token', parsedResponse.refresh_token);
  }
  return parsedResponse.access_token;
}

function getNowPlaying(
  access_token: string,
  basic_authorization: string
): string | null {
  const options = {
    headers: { Authorization: 'Bearer ' + access_token },
    muteHttpExceptions: true, // 401エラーへの対応のため
  };
  const response = UrlFetchApp.fetch(
    'https://api.spotify.com/v1/me/player/currently-playing',
    options
  );

  switch (response.getResponseCode()) {
    case 200: // Spotify の曲をセット
      console.log('Spotify の曲をセット');
      return getArtistAndSongString(response);

    case 204: // 何も聞いていない
      console.log('何も聞いていない');
      return null;
    case 401: // access_token が切れた
      const refreshed_access_token =
        refreshAccessTokenToSpotify(basic_authorization);
      console.log('access_token が切れた');
      return getNowPlaying(refreshed_access_token, basic_authorization);
    default:
      // 実行されない想定
      console.log('実行されない想定');
      return null;
  }
}

function setSlackStatus(
  slack_user_id: string,
  status_text: string,
  status_emoji: string
): void {
  const data = {
    profile: { status_text: status_text, status_emoji: status_emoji },
  };
  const payload = JSON.stringify(data);
  const token = PropertiesService.getScriptProperties().getProperty(
    'SLACK_AUTHORIZATION_TOKEN'
  )!;

  const options = {
    method: 'post',
    payload: payload,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-type': 'application/json',
    },
  } as const;
  const res = UrlFetchApp.fetch(
    'https://slack.com/api/users.profile.set?user=' + slack_user_id,
    options
  );
  console.log(payload);
}

function getArtistAndSongString(response: any): string {
  const parsedResponse = JSON.parse(response);
  const artist = parsedResponse.item.album.artists[0].name;
  const song = parsedResponse.item.album.name;
  return artist + '/' + song;
}

declare let global: any;
global.setSlackStatusFromSpotifyApp = setSlackStatusFromSpotifyApp;
