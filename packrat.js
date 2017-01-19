var Steam = require("steam"),
    util = require("util"),
    config = require("./config.js"),
    process = require("process"),
    fs = require("fs"),
    exec = require('child_process').execSync,
    csgo = require("csgo"),
    sprintf = require("sprintf-js").sprintf,
    readlineSync = require("readline-sync"),
    protos = require("csgo/helpers/protos"),
    crypto = require("crypto");

function makeSha(bytes) {
    var hash = crypto.createHash('sha1');
    hash.update(bytes);
    return hash.digest();
}

function getLegacyRoundStats(match) {
    if (match.roundstats_legacy)
        return match.roundstats_legacy;
    for (var i = 0; i < match.roundstatsall.length; ++i) {
        var roundstat = match.roundstatsall[i];
        if (roundstat.map && roundstat.reservationid)
            return roundstat;
    }
}

function fileExists(path) {
    try {
        fs.accessSync(path);
        return true;
    } catch (e) {
        return false;
    }
};

function downloadLink(link, path) {
    util.log('Downloading', link);
    var bz2Path = path + '.bz2';
    try {
        exec('wget -nv -O ' + bz2Path + ' ' + link);
        exec('bunzip2 ' + bz2Path);
    } catch (e) {
        util.log('Error downloading replay', link);
    }
}

function downloadMatches(matchList) {
    for (var i = 0; i < matchList.length; ++i) {
        var match = matchList[i];
        rs = getLegacyRoundStats(match);
        if (!rs) {
            util.log("Cannot get info for match");
            continue;
        }
        var dotDem = config.replays_path + '/' + sprintf('match730_%021s_%010s_%s.dem', rs.reservationid, match.watchablematchinfo.tv_port, match.watchablematchinfo.server_ip);
        var dotDemDotInfo = dotDem + '.info';
        if (!fileExists(dotDem))
            downloadLink(rs.map, dotDem);
        if (!fileExists(dotDemDotInfo)) {
            rs.map = null;
            util.log('Creating', dotDemDotInfo);
            var dotInfoData = protos.CMsgGCCStrike15_v2_MatchmakingServerRoundStats.encode(rs);
            fs.writeFileSync(dotDemDotInfo, dotInfoData.buffer);
        }
    }
}

function hasSentry(account) {
    try {
        fs.readFileSync(account.username + '.sentry');
    } catch (e) {
        return false;
    }
    return true;
}

function downloadMatchesForAccount() {
    var bot = new Steam.SteamClient(),
        steamUser = new Steam.SteamUser(bot),
        steamGC = new Steam.SteamGameCoordinator(bot, 730),
        CSGOCli = new csgo.CSGOClient(steamUser, steamGC, false),
        username = process.argv[2],
        password = process.argv[3],
        sentryPath = username + '.sentry',
        logOnDetails = {
            "account_name": username,
            "password": password,
        };

    try {
        var sentry = fs.readFileSync(username + '.sentry');
        if (sentry.length)
            logOnDetails.sha_sentryfile = makeSha(sentry);
    } catch (e) {
        util.log('Cannot read sentry for', account.username, e);
        process.exit(1);
    }

    CSGOCli.on("unhandled", function (message) {
        util.log("Unhandled msg");
        util.log(message);
    }).on("ready", function () {
        CSGOCli.requestRecentGames();
        CSGOCli.on("matchList", function (list) {
            if (list.matches && list.matches.length > 0)
                downloadMatches(list.matches);
            process.exit(0);
        });
    }).on("unready", function onUnready() {
        util.log("node-csgo unready.");
    }).on("unhandled", function (kMsg) {
        util.log("UNHANDLED MESSAGE " + kMsg);
    });

    steamUser.on('updateMachineAuth', function (response, callback) {
        fs.writeFileSync(sentryPath, response.bytes);
        callback({ sha_file: makeSha(response.bytes) });
    });
    bot.on("logOnResponse", function (response) {
        util.log('Attempt to log in', logOnDetails);
        if (response.eresult != Steam.EResult.OK) {
            util.log('Error logging in', username, response, logOnDetails);
            process.exit();
        }
        util.log("Logged in SteamID64: " + bot.steamID, username);
        CSGOCli.launch();
    }).on('sentry', function onSteamSentry(sentry) {
        util.log("Received sentry.");
        fs.writeFileSync(sentryPath, sentry);
    }).on('connected', function () {
        steamUser.logOn(logOnDetails);
    });
    bot.connect();
}

function createSentryFiles() {
    var bot = new Steam.SteamClient(),
        steamUser = new Steam.SteamUser(bot),
        account, sentryPath, logOnDetails = {},
        accountNumber = -1,
        SLEEP_TIME = 5000,
        accounts = config.accounts.filter(function (a) { return !hasSentry(a); });

    function nextAccount() {
        accountNumber++;
        for (; accountNumber < accounts.length; accountNumber++) {
            account = accounts[accountNumber];
            sentryPath = account.username + '.sentry';
            logOnDetails = {
                "account_name": account.username,
                "password": account.password,
            };
            return true;
        }
        return false;
    }

    function onSteamLogOn(response) {
        util.log('Attempted to log in user', logOnDetails.account_name, '(result ' + response.eresult + ')');
        if (response.eresult != Steam.EResult.OK) {
            if (response.email_domain) {
                var authCode = readlineSync.question('AuthCode: ');
                if (authCode)
                    logOnDetails.auth_code = authCode;
                bot.connect();
            } else {
                util.log("Failed to log in", response);
                util.log("exiting");
                process.exit();
            }
        } else if (logOnDetails.sha_sentryfile)
            loginNextAccount();
    };

    function loginNextAccount() {
        if (nextAccount())
            bot.connect();
        else
            process.exit();
    }

    function writeSentry(sentry, f) {
        fs.writeFileSync(sentryPath, sentry);
        if (f)
            f();
        logOnDetails.sha_sentryfile = makeSha(sentry);
        logOnDetails.auth_code = null;
        // Have to sleep on the sentry for a bit otherwise the server forgets it
        // https://github.com/seishun/node-steam/issues/67
        setTimeout(function () { bot.connect(); }, SLEEP_TIME);
    }
    steamUser.on('updateMachineAuth', function (response, callback) {
        writeSentry(response.bytes, function () { callback({ sha_file: makeSha(response.bytes) }); });
    });
    bot.on("logOnResponse", onSteamLogOn)
        .on('sentry', function onSteamSentry(sentry) {
            util.log("Received sentry.");
            writeSentry(sentry);
        })
        .on('connected', function () {
            steamUser.logOn(logOnDetails);
        })
        .on('error', function onError() {
            util.log("SteamClient error.");
        });

    loginNextAccount();
}

if (process.argv.length == 4) {
    downloadMatchesForAccount();
} else if (process.argv.length == 2) {
    (function execute() {
        var accounts = config.accounts.filter(hasSentry);
        for (var i = 0; i < accounts.length; i++)
            exec(sprintf('node %s %s %s', process.argv[1], accounts[i].username, accounts[i].password), { stdio: [0, 1, 2] });
    })();
} else if (process.argv.length == 3) {
    createSentryFiles();
}
