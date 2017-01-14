var Steam = require("steam"),
    util = require("util"),
    config = require("./config.js"),
    fs = require("fs"),
    exec = require('child_process').execSync,
    csgo = require("csgo"),
    sprintf = require("sprintf-js").sprintf,
    readlineSync = require("readline-sync"),
    protos = require("csgo/helpers/protos"),
    crypto = require("crypto");

function MakeSha(bytes) {
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

function onSteamSentry(sentry) {
    util.log("Received sentry.");
    fs.writeFileSync(sentryPath, sentry);
};

function onSteamLogOn(response) {
    if (response.eresult == Steam.EResult.OK) {
        util.log('Logged in!');
    } else {
        util.log('Error logging in', account.username, response);
        process.exit();
    }
    steamFriends.setPersonaState(Steam.EPersonaState.Busy);

    util.log("Logged on.");
    util.log("Current SteamID64: " + bot.steamID);
    util.log("Account ID: " + CSGOCli.ToAccountID(bot.steamID));

    CSGOCli.launch();
};

var bot = new Steam.SteamClient(),
    steamUser = new Steam.SteamUser(bot),
    steamFriends = new Steam.SteamFriends(bot),
    steamGC = new Steam.SteamGameCoordinator(bot, 730),
    CSGOCli = new csgo.CSGOClient(steamUser, steamGC, false),
    account, sentryPath, logOnDetails = {},
    accountNumber = -1;

CSGOCli.on("unhandled", function (message) {
    util.log("Unhandled msg");
    util.log(message);
}).on("ready", function () {
    util.log("node-csgo ready.");
    CSGOCli.requestRecentGames();
    CSGOCli.on("matchList", function (list) {
        util.log("Got match list!", list.matches.length);
        if (list.matches && list.matches.length > 0)
            downloadMatches(list.matches);
        if (nextAccount())
            bot.connect();
        else
            process.exit();
    });
}).on("unready", function onUnready() {
    util.log("node-csgo unready.");
}).on("unhandled", function (kMsg) {
    util.log("UNHANDLED MESSAGE " + kMsg);
});

function nextAccount() {
    accountNumber++;
    if (accountNumber >= config.accounts.length)
        return false;
    account = config.accounts[accountNumber];
    sentryPath = account.username + '.sentry';
    logOnDetails = {
        "account_name": account.username,
        "password": account.password,
    };
    try {
        var sentry = fs.readFileSync(account.username + '.sentry');
        if (sentry.length)
            logOnDetails.sha_sentryfile = MakeSha(sentry);
    } catch (e) {
        util.log(e);
        var authCode = readlineSync.question('AuthCode: ');
        if (authCode)
            logOnDetails.auth_code = authCode;
    }
    return true;
}

nextAccount();
bot.connect();

steamUser.on('updateMachineAuth', function (response, callback) {
    fs.writeFileSync(sentryPath, response.bytes);
    callback({ sha_file: MakeSha(response.bytes) });
});
bot.on("logOnResponse", onSteamLogOn)
    .on('sentry', onSteamSentry)
    .on('connected', function () {
        steamUser.logOn(logOnDetails);
    });
