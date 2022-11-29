const express = require('express');
const app = express();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const clientCredentials = require('./client-credentials.json');
const editJsonFile = require("edit-json-file");
const fs = require('fs');
const { getgroups } = require('process');

const redirect_uri = 'http://localhost:3000/callback';

const SECRET = 'maclesecrete'

let mapping = []

app.get("/signup", (req, res) => {
    if (!req.query.username || !req.query.password) {
        return res.status(400).json({ message: 'Veuillez entrer un login et un mot de passe' })
    }

    var users = require('./Users.json');
    const user = users.find(u => u.username === req.query.username)

    if (user) {
        return res.status(400).json({ message: 'Utilisateur existe déjà' })
    }
    let file = editJsonFile(`Users.json`);
    var user_data = { "username": req.query.username, "password": req.query.password };
    
    file.append("", user_data);
    file.save();

    return res.json({ message: 'Utilisateur créé' })
})

app.get("/signin", (req, res) => {
    if (!req.query.username || !req.query.password) {
        return res.status(400).json({ message: 'Veuillez entrer un login et un mot de passe exemple ?username= &password=' })
    }

    var users = require('./Users.json');
    const user = users.find(u => u.username === req.query.username && u.password === req.query.password)

    if (!user) {
        return res.status(400).json({ message: 'Mauvais login ou mot de passe' })
    }

    const token = jwt.sign({
        id: user.id,
        username: user.username
    }, SECRET, { expiresIn: '1h' })

    res.header('Content-Type', 'application/json')
    return res.json({ access_token: token, link: `localhost:3000/auth-url?token=${token}` })
})

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}


function getRandomState(max) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for ( let i = 0; i < max; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}


app.get("/group", (req, res) => {
    const token = req.query.token;
    var users = require('./Users.json');
    jwt.verify(token, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })

    if (!req.query.name) {
        return res.status(400).json({ message: 'Veuillez entrer un nom de groupe' })
    }

    const decoded = jwt.decode(token)
    const user = users.filter(u => u.username == decoded.username)[0];

    var groups = require('./Groups.json');
    let file = editJsonFile(`./Groups.json`);

    let keys = Object.keys(groups);

    if (file.get(req.query.name + "." + user.username) === undefined) {
        for (let i = 0; i < keys.length; i++) {
            var user_keys = Object.keys(file.toObject()[keys[i]]);
            console.log(user_keys);
            for (let j = 0; j < user_keys.length; j++) {
                if (user_keys[j] == user.username) {
                    file.unset(keys[i] + "." + user_keys[j]);
                    var user_keys_bis = Object.keys(file.toObject()[keys[i]]);
                    if (!user_keys_bis.length == 0) {
                        var integer = getRandomInt(user_keys_bis.length);
                        file.set(keys[i] + "." + user_keys_bis[integer], true);
                    }
                }
            }
        }

        for (let i = 0; i < keys.length; i++) {
            var user_keys = Object.keys(file.toObject()[keys[i]]);
            console.log(keys[i]);
            if (user_keys.length === 0) {
                file.unset(keys[i])
            }
        }

        if (!file.get(req.query.name)) {
            file.set(req.query.name, {});
            file.set(req.query.name + "." + user.username, true);
        }
        else {
            file.set(req.query.name + "." + user.username, false);
        }

        file.save();
    }

    return res.json({ message: 'fin' })
})

app.get("/grouplist", (req, res) => {
    const token = req.query.token;
    var users = require('./Users.json');
    jwt.verify(token, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })

    const decoded = jwt.decode(token)

    var groups = require('./Groups.json');
    let file = editJsonFile(`./Groups.json`);

    let text = '';
    let keys = Object.keys(groups);
    for (let i = 0; i < keys.length; i++) {
        var group_keys = Object.keys(file.toObject()[keys[i]]);
        text += "Nom: " + keys[i];
        text += " Nombre de personnes dans le groupe: " + Object.keys(group_keys).length;
        text += ' <br> ';
        // A faire
        // Refaire l'affichage du texte
    }
    //return res.json({ message: text })
    res.set('Content-Type', 'text/html');
    res.send(JSON.stringify(text));
})

app.get("/mygroup", (req, res) => {
    const token = req.query.token;
    var users = require('./Users.json');
    jwt.verify(token, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })

    const decoded = jwt.decode(token)
    const user = users.filter(u => u.username == decoded.username)[0];

    var groups = require('./Groups.json');
    let file = editJsonFile(`./Groups.json`);

    let text = '';
    let group_keys = Object.keys(groups);

    for (let i = 0; i < group_keys.length; i++) {

        var user_keys_bis = Object.keys(file.toObject()[group_keys[i]]);
        console.log(user_keys_bis);
        if (user_keys_bis.includes(user.username)) {
            text += "Nom: " + user.username;
            text += ' <br> ';
            text += " Nom du groupe: " + group_keys[i];
            // A faire
            // Affichier si lié a un compte Spotify ect

            // A faire aussi
            // Refaire l'affichage du texte
        }
    }

    if (text = '') {
        text = "L'utilisateur n'appartient à aucun groupe"
    }

    res.set('Content-Type', 'text/html');
    res.send(JSON.stringify(text));
})

let user = {}

app.get("/auth-url", (req, res) => {
    var users = require('./Users.json');
    let connect = require('./SpotifyAccounts.json')
    let user2 = []

    if (req.query.token){
        jwt.verify(req.query.token, SECRET, (err, decodedToken) => {
            if (err) {
                res.status(401).json({ message: 'Token invalide' })
            }else{
                user = users.filter(u => u.username == decodedToken.username)[0]
                for (let i = 0; i < connect.length; i++) {
                    if (user.username === connect[i].username) {
                        user2 = connect[i]
                    }    
                }
                if (!user.access_token && !user2.refresh_token) {

                    let state = getRandomState(12)

                    mapping[`${state}`] = user.username


                    const scope = 'user-read-private user-read-email user-read-recently-played';
                    res.send('https://accounts.spotify.com/authorize?' +
                        querystring.stringify({
                            response_type: 'code',
                            client_id: clientCredentials.id,
                            scope: scope,
                            redirect_uri: redirect_uri,
                            state: state
                        }));
                }else{
                    //res.send(user2);
                    res.send('Access token: ' + JSON.stringify(user2.refresh_token))
                }
            }
        })
    }else if(req.query.code){
        console.log(req.query.state);
        let code = req.query.code
        console.log(user);
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' +
                    (Buffer.from(clientCredentials.id + ':' + clientCredentials.secret).toString('base64')),
                'content-type': 'application/x-www-form-urlencoded'
            },
        };
        axios.post(authOptions.url, authOptions.form, {
            headers: authOptions.headers
        }).then((response) => {
            const data = response.data;

            user['refresh_token'] = data.refresh_token
            var user_data = { "username": user.username, "refresh_token": user.refresh_token };
            try {
                let file = editJsonFile(`SpotifyAccounts.json`);
                file.append("", user_data);
                file.save();
                console.log("Information sauvé");
            } catch (err) {
                console.log('================');
                console.log(err);
                console.log('================');
            }

            res.send(data)
        }).catch((err) => {
            console.log(err)
        });

    }

});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state
    console.log("state =>" + state);
    res.redirect('/auth-url?code=' + code + '&state=' + state)

});

app.get('/recently-played', async (req, res) => {
    const auth = req.header('Authorization');

    if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized');
        return;
    }

    const token = auth.split(' ')[1];

    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });

    res.json(response.data);
});

app.listen(3000, () => {
    console.log("Server listening... port : 3000")
});
