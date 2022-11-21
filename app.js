const express = require('express');
const app = express();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const clientCredentials = require('./client-credentials.json');
const editJsonFile = require("edit-json-file");
const fs = require('fs');
const { getgroups } = require('process');

const redirect_uri = 'http://localhost:3000/callback/';

const SECRET = 'maclesecrete'

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
        return res.status(400).json({ message: 'Veuillez entrer un login et un mot de passe' })
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

    return res.json({ access_token: token })
})

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
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

app.get("/auth-url", (req, res) => {
    const scope = 'user-read-private user-read-email user-read-recently-played';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: clientCredentials.id,
            scope: scope,
            redirect_uri: redirect_uri,
        }));
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;

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
        console.log(data);
        res.json(data);
    }).catch((err) => {
        console.log(err)
    });
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
    console.log("Server listening...")
});
