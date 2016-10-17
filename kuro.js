let Eris = require("eris");
let reload = require('require-reload')(require)
let http = require('http');
let fs = require('fs');
let _config = require('./config.json');
let _stickers; // = require('./stickers.json');

try {
    _stickers = reload('./stickers.json');
} catch (e) {
    _stickers = {};
    let json = JSON.stringify(_stickers);
    fs.writeFile('stickers.json', json, 'utf8', function(){
        reloadStickers();
    });
}

let kuro = new Eris.CommandClient(_config.token, { userAccount: true }, {
    description: "A nice selfbot built in eris",
    owner: _config.owner,
    prefix: "/",
    ignoreSelf: false,
    defaultHelpCommand: false,
    defaultCommandOptions: {
        requirements: {
            "userIDs": [_config.userID]
        }
    }
});

kuro.on("ready", () => {
    console.log("[Kuro]: Ready!");
});

/*
    Usage: /sticker add _name_ attachment|_url_
    Kuro will try to upload a new sticker to stickers.json. She will either try
    to parse the url from a given string and if there is none try to get the
    public link of an attached file.

    Usage: /sticker del _name_
    Kuro will try to delete a sticker by that name on stickers.json

    Usage: /sticker list
    Kuro will list all the stickers in stickers.json

    Usage: /sticker _name_
    Kuro will try to map _file_ to an existing image through stickers.json and
    then upload said image. After it's done, she will delete the message that
    triggered the command.
*/

kuro.registerCommand("sticker", (msg, args) => {

    let command = args[0];
    if (command.toString().trim() === 'add'){
        // Treat this as the name of the new sticker
        if(args[1] !== undefined){
            // First lets check if that name is already used.
            if(args[1] in _stickers){
                kuro.editMessage(msg.channel.id, msg.id, "You already used that name.").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
            }else{

                let name = args[1];
                let dest = './stickers/' + args[1] + '.png';

                // Treat this as the url of the file to add
                if(args[2] !== undefined){
                    let url = args[2].replace('https://', 'http://');
                    downloadImage(name, url, dest, msg);
                }else{
                    // If there is no url of the file, let's see if there is an attachment
                    if(msg.attachments.length > 0){
                        if('proxy_url' in msg.attachments[0]){
                            let url = msg.attachments[0].proxy_url.replace('https://', 'http://');
                            downloadImage(name, url, dest, msg);
                        }else{
                            kuro.editMessage(msg.channel.id, msg.id, "Eto.. this is weird, there was no [proxy_url] in the uploaded object.").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
                        }
                    }else{
                        kuro.editMessage(msg.channel.id, msg.id, "You didnt supply either a url nor attachment, you dumdum.").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
                    }
                }
            }

        }else{
            kuro.editMessage(msg.channel.id, msg.id, "No name supplied, dummy.").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
        }
    }else if (command.toString().trim() === 'del'){
        if(args[1] !== undefined){
            delSticker(args[1], msg);
        }
    }else if (command.toString().trim() === 'list'){

        let list = '```';
        for(sticker in _stickers){
            list = list + ' ' + sticker + '\n';
        }
        list = list + '```';
        kuro.editMessage(msg.channel.id, msg.id, list).then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 5000));;

    }else if (command.toString().trim() === 'show'){
        // Soon

    }else{
        let name = command;
        if(name in _stickers){

            let img = fs.readFileSync('stickers/' + _stickers[name]);
            kuro.createMessage(msg.channel.id, '', {
                file: img,
                name: _stickers[name]
            });
            kuro.deleteMessage(msg.channel.id, msg.id);

        }else{
            kuro.editMessage(msg.channel.id, msg.id, "That sticker doesnt exist. rip").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
        }
    }


}, {requirements:{"userIDs":[_config.userID]}});

/*
    Usage: /prune _number_
    Kuro will get the last _number_ messages from the channel where the command
    was triggered.
*/

kuro.registerCommand("prune", (msg, args) => {
    let msgCount = parseInt(args);
    kuro.getMessages(msg.channel.id, 100)
        .then((messages) => {
            let filtered = messages.filter(m => m.author.id === kuro.user.id);
            filtered.length = msgCount + 1;
            filtered.map((msg, i) => kuro.deleteMessage(msg.channel.id, msg.id));
        });
}, {requirements:{"userIDs": [_config.userID]}});

/* HELPER FUNCTIONS */
let addNewSticker = function(name, msg){

    _stickers[name] = name + '.png';
    let json = JSON.stringify(_stickers);
    fs.writeFile('stickers.json', json, 'utf8', function(){
        reloadStickers();
        kuro.deleteMessage(msg.channel.id, msg.id);
        kuro.createMessage(msg.channel.id, 'Sticker added succesfully fam \o/').then(function(newmsg){
            setTimeout( () => kuro.deleteMessage(newmsg.channel.id, newmsg.id), 3000);
        });
    });

}

let delSticker = function(name, msg){

    if(name in _stickers){

        delete(_stickers[name]);
        let json = JSON.stringify(_stickers);
        fs.writeFile('stickers.json', json, 'utf8', function(){
            reloadStickers();
            kuro.editMessage(msg.channel.id, msg.id, "The sticker was removed o7").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
        });

    }else{
        kuro.editMessage(msg.channel.id, msg.id, "There is no sticker by that name, you wonderful person.").then(() => setTimeout( () => kuro.deleteMessage(msg.channel.id, msg.id), 3000));
    }

}

let reloadStickers = function(){
    _stickers = reload('./stickers.json');
}

let downloadImage = function(name, url, dest, msg) {
    let file = fs.createWriteStream(dest);
    let request = http.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(addNewSticker(name, msg));  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        kuro.editMessage(msg.channel.id, msg.id, "***Error:*** " + err.message);
    });
};

kuro.connect();