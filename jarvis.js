#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var Discord = require('discord.js');

// Load config, and stored data
var config = JSON.parse(fs.readFileSync("config.json"));

// Create a new Discord Client instance
var bot = new Discord.Client();

// Create a http server for GitHub webhooks
var server = http.createServer(handleHttpRequest);

server.listen(config["webserver"]["port"], function() {
    console.log("The server is now listening on port " + config["webserver"]["port"]);
});

function handleHttpRequest(request, response) {
    // Get the body of the POST request
    var textBody = "";
    request.on('data', function(chunk) {
        textBody += chunk;
    });

    // Called when the request has finished being received
    request.on('end', function() {
        // Send a response back to GitHub
        response.end();

        var body = JSON.parse(textBody);

        // For debugging
        var time = new Date().getTime().toString();
        fs.writeFile("data/" + time + "-body.json", JSON.stringify(body, null, 2));
        fs.writeFile("data/" + time + "-headers.json", JSON.stringify(request.headers, null, 2));

        // Pick a function based on event name
        var type = request.headers["x-github-event"];
        if (type == "push") {
            processPush(body);
        } else if (type == "issues") {
            processIssueAction(body);
        } else if (type == "issue_comment") {
            processIssueComment(body);
        }
    });
}

// Send a message for push events
function processPush(data) {
    var user = data["head_commit"]["author"]["username"];
    var repository = data["repository"]["full_name"];
    var commitMessage = data["head_commit"]["message"];
    var commitLink = data["head_commit"]["url"];

    var message = user + " pushed to " + repository;
    message += "\n" + commitMessage;
    message += "\n\nLink: " + commitLink;

    sendMessageToDiscord(message);
}

// Send a message for issue events
function processIssueAction(data) {
    var user = data["issue"]["user"]["login"];
    var repository = data["repository"]["full_name"];
    var action = data["action"];
    var issueNum = data["issue"]["number"];
    var issueTitle = data["issue"]["title"];
    var issueLink = data["issue"]["html_url"];

    var message = user + " " + action + " " + repository + "#" + issueNum;
    message += "\n" + issueTitle;
    message += "\n\nLink: " + issueLink;

    sendMessageToDiscord(message);
}

// Send a message for issue comments
function processIssueComment(data) {
    var user = data["comment"]["user"]["login"];
    var repository = data["repository"]["full_name"];
    var comment = data["comment"]["body"];
    var issueNum = data["issue"]["number"];
    var commentLink = data["comment"]["html_url"];

    var message = user + " commented on " + repository + "#" + issueNum;
    message += "\n" + comment;
    message += "\n\nLink: " + commentLink;

    sendMessageToDiscord(message);
}

// This function is here so that we can easily send the message to the channel specified in the config
function sendMessageToDiscord(message) {
    for (var x = 0; x < bot.servers.length; x++) {
        var server = bot.servers[x];

        // If the current server name does not match the one in the config, skip it
        if (server.name != config["discord"]["server"]) {
            continue;
        }

        for (var y = 0; y < server.channels.length; y++) {
            var channel = server.channels[y];

            // If the current channel name does not match the one in the config, skip it
            if (channel.name != config["discord"]["channel"]) {
                continue;
            }

            // The channel and server match the ones in the config. Send the message
            bot.sendMessage(channel, message);
            return;
        }
        console.log("Channel not found");
    }

    console.log("Server not found");
}

// Called when the bot is connected to Discord
bot.on("ready", function() {
    // Set the game the bot is currently playing to that in the config
    bot.setPlayingGame(config["discord"]["game"]);
});

// Called whenever a message is sent in Discord
bot.on("message", function(message) {
    console.log(message.content);
});

// Start the Discord bot
bot.loginWithToken(config["discord"]["token"]);

