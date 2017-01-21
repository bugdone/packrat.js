Like [packrat](https://github.com/bugdone/packrat), but using SteamKit instead of Steam SDK (no windows popping :tada:)

# Requirements
* `bunzip2` and `wget` must be in `PATH`
* the CS:GO accounts must **not** have Steam Guard Mobile Authenticator

# Setup
1. Create `config.js` with the username/passwords for the accounts you want to download as well as the location. See `config.js.sample`
2. Run `node packrat.js init`. It will log in each account and ask for a Steam Guard code. Run this each time you add a new account or delete the `.sentry` files it creates.

# Usage
Run `node packrat.js`. Logs in each account and downloads the last 8 demos if they are not present in the configured location and are still available.
