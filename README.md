Like [packrat](https://github.com/bugdone/packrat), but using SteamKit instead of Steam SDK (no windows popping :tada:)

# Requirements

- `bunzip2` and `wget` must be in `PATH`
- at least one CS:GO account must **not** have Steam Guard Mobile Authenticator enabled

# Setup

1. Copy `config.js.sample` to `config.js`.
2. Set `replays_path` to the path you want to store the demos in.
3. Fill `accounts` with the Steam accounts that don't have Steam Guard Mobile Authenticator enabled. You need at least one account here. For these accounts, it will try download the last 8 demos if they are available. Note that if you play more than 8 matches between runs of `packrat.js`, it will not download all your demos! If this is your usecase, see 4.
4. For the accounts that have Steam Guard Mobile Authenticator enabled or on which you're playing more than 8 games between `packrat.js` runs, you need to:

- generate an [Game Authentication Code](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Access_Match_History#Creating_Game_Authentication_Code)
- add the Game Authentication Code and the steamid to `auth_accounts`
- create a `<username>.lastmatch` file with a match sharing code of a demo featuring that account (you can get it in the Watch tab in CSGO while logged in as `<username>`)

5. If you have accounts set in `auth_accounts`, you also need to fill in `steam_api_key` ([Creating Steam Web API Key](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Access_Match_History#Creating_Steam_Web_API_Key)).
6. Run `node packrat.js init`. It will log in each account set in `accounts` and ask for a Steam Guard code. Run this each time you add a new account into `accounts` or delete the `<username>.sentry` files it creates.

# Usage

Run `node packrat.js`. Logs in each account in `accounts` and downloads the last 8 demos if they are still available but not present in `replays_path`. It will also go through all `auth_accounts` and download all demos that are still available but not present in `replays_path` starting from the match sharing code in `<username>.lastmatch`.
