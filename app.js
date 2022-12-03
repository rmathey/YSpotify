const express = require('express');
const app = express();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const clientCredentials = require('./client-credentials.json');
const editJsonFile = require("edit-json-file");

const redirect_uri = 'http://localhost:3000/callback/';

const SECRET = 'EwsMvqu4NQQeyuFeWDcWN3KuhZ2gWc1jaEL6J64oQuGSPQUrtOzuJ5MLmhJ4CsbmOGiu25'
const client_id = clientCredentials.id; // Your client id
const client_secret = clientCredentials.secret; // Your secret
const request = require('request');
const cors = require('cors');
app.use(cors());


// Extended: https://swagger.io/specification/#infoObject
const options = {
    swaggerDefinition: {
        info: {
            title: "YSpotify",
            servers: ["http://localhost:3000"]
        }
    },
    apis: ["app.js"]
};

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

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

app.get("/mygroup", async (req, res) => {
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

    var text = '';
    let group_keys = Object.keys(groups);

    for (let i = 0; i < group_keys.length; i++) {

        var user_keys_bis = Object.keys(file.toObject()[group_keys[i]]);
        var spotify_accounts = require('./SpotifyAccounts.json');
        var spotify_file = editJsonFile(`./SpotifyAccounts.json`);
        if (user_keys_bis.includes(user.username)) {
            for (let j = 0; j < user_keys_bis.length; j++) {
                text += "Nom: " + user_keys_bis[j];
                text += ' <br> ';
                text += " | Nom du groupe: " + group_keys[i];
                var spotify_account = spotify_accounts.filter(u => u.username == user_keys_bis[j])[0];
                if (spotify_account !== undefined) {
                    const access_token_request = await axios.get('http://localhost:3000/refresh_token/?refresh_token=' + spotify_account.refresh_token);

                    const requete_pseudo = await axios.get(
                        'https://api.spotify.com/v1/me',
                        {
                            headers: {
                                Authorization: `Bearer ${access_token_request.data.access_token}`
                            }
                        });
                    text += " | Pseudo Spotify: " + requete_pseudo.data.display_name;

                    var requete_musique = await axios.get(
                        'https://api.spotify.com/v1/me/player/currently-playing/?scope=user-read-currently-playing',
                        {
                            headers: {
                                Authorization: `Bearer ${access_token_request.data.access_token}`
                            }
                        });
                    if (requete_musique.data) {
                        var artists = ''
                        requete_musique.data.item.artists.forEach(function (item) {
                            artists += item.name;
                            artists += " ";
                        });
                        text += " | Morceau en cours d'écoute: " + requete_musique.data.item.name + " de " + artists;
                    }
                    else {
                        text += " | Aucune écoute actuellement";
                    }

                    var requete_device = await axios.get(
                        'https://api.spotify.com/v1/me/player/devices',
                        {
                            headers: {
                                Authorization: `Bearer ${access_token_request.data.access_token}`
                            }
                        });
                    var devices = ''
                    requete_device.data.devices.forEach(function (item) {
                        console.log(item);
                        devices += item.name;
                        devices += " ";
                    });
                    text += " | En écoute sur: " + devices;

                }
                text += ' <br> ';
            }
            // Refaire l'affichage du texte
        }
    }

    if (text == '') {
        text = "L'utilisateur n'appartient à aucun groupe"
    }
    res.set('Content-Type', 'text/html');
    res.send(JSON.stringify(text));
})


app.get("/auth-url", (req, res) => {
    const token = req.query.token;
    jwt.verify(token, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })

    const decoded = jwt.decode(token)

    const scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing user-read-playback-state';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: clientCredentials.id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: decoded.username
        }));
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    var username = req.query.state;
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
        var spotify_file = editJsonFile(`./SpotifyAccounts.json`);
        var refresh_token = data.refresh_token;
        spotify_file.append("", { "username": username, "refresh_token": refresh_token })
        spotify_file.save();
        res.json(data);
    }).catch((err) => {
        console.log(err)
    });
});

app.get('/refresh_token', function (req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});

app.listen(3000, () => {
    console.log("Server listening...")
});