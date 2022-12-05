const express = require('express');
const app = express();
const querystring = require('querystring');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const clientCredentials = require('./client-credentials.json');
const editJsonFile = require("edit-json-file");

const redirect_uri = 'http://localhost:3000/callback/';

const SECRET = 'EwsMvqu4NQQeyuFeWDcWN3KuhZ2gWc1jaEL6J64oQuGSPQUrtOzuJ5MLmhJ4CsbmOGiu25'
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
const { constants } = require('zlib');

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

    return res.json({ message: 'Opération réussi' })
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
        text += " ,Nombre de personnes: " + Object.keys(group_keys).length;
        if (i != keys.length - 1) {
            text += ' | ';
        }
    }
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
                text += " ,Nom du groupe: " + group_keys[i];
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
                        text += " ,Morceau en cours d'écoute: " + requete_musique.data.item.name + " de " + artists;
                    }
                    else {
                        text += " ,Aucune écoute actuellement";
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
                    text += " ,En écoute sur: " + devices;

                }
                if (j != user_keys_bis.length - 1) {
                    text += ' | ';
                }
            }
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


    const scope = 'user-read-private user-read-email user-read-recently-played user-read-currently-playing user-read-playback-state user-library-read user-modify-playback-state playlist-read-private playlist-read-collaborative user-top-read playlist-modify-public playlist-modify-private';
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
        headers: { 'Authorization': 'Basic ' + (new Buffer.from(clientCredentials.id + ':' + clientCredentials.secret).toString('base64')) },
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

app.get("/userpersonality", async (req, res) => {
    const token = req.query.token;
    var users = require('./Users.json');

    jwt.verify(token, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })
    console.log('infos du user');
    const decoded = jwt.decode(token)
    const user = users.filter(u => u.username == decoded.username)[0];

    var text = '';

    var spotify_accounts = require('./SpotifyAccounts.json');
    var spotify_account = spotify_accounts.filter(u => u.username == user.username)[0];
    if (spotify_account !== undefined) {
        const access_token_request = await axios.get('http://localhost:3000/refresh_token/?refresh_token=' + spotify_account.refresh_token);
        var arg_danceability = 0;
        var avg_tempo = 0;
        var avg_instrumentalness = 0;
        var avg_valence = 0;

        const requete_pseudo = await axios.get(
            'https://api.spotify.com/v1/me',
            {
                headers: {
                    Authorization: `Bearer ${access_token_request.data.access_token}`
                }
            });
        text += " Personnalité Utilisateur :";
        text += "| Pseudo Spotify: " + requete_pseudo.data.display_name;
        var requete_tracks = await axios.get(
            'https://api.spotify.com/v1/me/tracks',
            {
                headers: {
                    Authorization: `Bearer ${access_token_request.data.access_token}`
                }
            });
        text += " | Nombre de musiques likés: " + requete_tracks.data.total;

        for (let i = 0; i < requete_tracks.data.items.length; i++) {
            var element = requete_tracks.data.items[i];

            var requete_audio_features = await axios.get(
                'https://api.spotify.com/v1/audio-features/' + element.track.id,
                {
                    headers: {
                        Authorization: `Bearer ${access_token_request.data.access_token}`
                    }
                });
            arg_danceability += requete_audio_features.data.danceability;
            avg_tempo = requete_audio_features.data.tempo;
            avg_instrumentalness = requete_audio_features.data.instrumentalness;
            avg_valence = requete_audio_features.data.valence
        }

        const len_tracks = requete_tracks.data.items.length;
        arg_danceability = arg_danceability / len_tracks;
        arg_danceability *= 10;
        arg_danceability = Math.round(arg_danceability);
        avg_tempo = avg_tempo / len_tracks;
        avg_instrumentalness = avg_instrumentalness / len_tracks;
        avg_valence = avg_valence / len_tracks;

        text += " | Attrait pour la dance: " + arg_danceability;
        text += " | Agitation: " + avg_tempo;
        text += " | Préférence entre les musiques vocales ou instrumentales: " + avg_instrumentalness;
        text += " | Attitude plutôt positive ou négative: " + avg_valence;

        // Stocker dans un tableau les valeurs tempo de chaque track 
        // Faire une boucle for avec i<10 faire 10 appels et ensuite faire la moyenne de ces valeurs

    }
    text += '  ';

    if (text == '') {
        text = "Pas de profil personnalité sur cet utilisateur"
    }
    res.set('Content-Type', 'text/html');
    res.send(JSON.stringify(text));


});

app.get("/sync", async (req, res) => {
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
    var is_leader = false;
    for (let i = 0; i < group_keys.length; i++) {
        var user_keys_bis = Object.keys(file.toObject()[group_keys[i]]);
        var spotify_accounts = require('./SpotifyAccounts.json');
        var spotify_file = editJsonFile(`./SpotifyAccounts.json`);
        var user_has_spotify_account = spotify_accounts.filter(u => u.username == user.username)[0];
        if (user_keys_bis.includes(user.username) && user_has_spotify_account !== undefined) {
            if (file.get(group_keys[i] + "." + user.username)) {
                is_leader = true;
                const access_token_request_user = await axios.get('http://localhost:3000/refresh_token/?refresh_token=' + user_has_spotify_account.refresh_token);
                const acces_token_user = access_token_request_user.data.access_token;
                var requete_musique = await axios.get(
                    'https://api.spotify.com/v1/me/player/currently-playing/',
                    {
                        headers: {
                            Authorization: `Bearer ${acces_token_user}`
                        }
                    });
                if (requete_musique.data) {
                    var artists = ''
                    requete_musique.data.item.artists.forEach(function (item) {
                        artists += item.name;
                        artists += " ";
                    });
                    var album_uri = requete_musique.data.item.album.uri;
                    var song_position = requete_musique.data.item.track_number - 1;
                    var song_progress_ms = parseInt(requete_musique.data.progress_ms);
                    text += " ,Track id: " + album_uri + " de " + artists;
                }
                else {
                    text = "Aucune écoute actuellement";
                }
                for (let j = 0; j < user_keys_bis.length; j++) {
                    var group_member_has_spotify_account = spotify_accounts.filter(u => u.username == user_keys_bis[j])[0];
                    if (group_member_has_spotify_account !== undefined) {
                        var access_token_request_member = await axios.get('http://localhost:3000/refresh_token/?refresh_token=' + group_member_has_spotify_account.refresh_token);
                        var acces_token_group_member = access_token_request_member.data.access_token;
                        console.log(acces_token_group_member);
                        var requete_musique = await axios.put(
                            'https://api.spotify.com/v1/me/player/play/',
                            {
                                "context_uri": album_uri,
                                "offset": {
                                    "position": song_position
                                },
                                "position_ms": song_progress_ms
                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${acces_token_group_member}`
                                }
                            });
                    }
                }
                text = "Opération réussi";
            }
        }
    }

    if (text == '') {
        text = "L'utilisateur doit: avoir lié son compte Spotify, doit être le chef du groupe, doit appartenir à un groupe  ";
    }
    res.set('Content-Type', 'text/html');
    res.send(JSON.stringify(text));
});

app.post('/addplaylist', async (req, res) => {

    const qToken = req.query.token;
    var users = require('./Users.json');
    jwt.verify(qToken, SECRET, (err, decodedToken) => {
        if (err) {
            res.status(401).json({ message: 'Token invalide' })
        }
    })

    const decoded = jwt.decode(qToken)
    const user = users.filter(u => u.username == req.query.username)[0];

    var spotify_file = require('./SpotifyAccounts.json');

    var spotify_account = spotify_file.filter(u => u.username == user.username)[0];

    if (spotify_account !== undefined) {
        const rfrshToken = spotify_account.refresh_token
        const access_token_request = await axios.get('http://localhost:3000/refresh_token/?refresh_token=' + rfrshToken);


        /// CREATION DE PLAYLIST 
        const token = access_token_request.data.access_token;

        const response_profile = await axios.get('	https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        var user_id = response_profile.data.id;

        const response_create_playlist = await axios.post('	https://api.spotify.com/v1/users/' + user_id + '/playlists', {
            'name': req.query.nom,
            'description': req.query.des,
            'public': false
        }, {
            headers: {
                'Authorization': 'Bearer ' + token
            },
        });
        console.log(response_create_playlist.data.id);
        var playlist_id = response_create_playlist.data.id;
        // RECUPERATION DES 10 TITRES FAVORIS 

        const response_get_titles = await axios.get('https://api.spotify.com/v1/me/top/tracks?limit=10&offset=0', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        console.log(response_get_titles.data.items);
        var tracks_data = response_get_titles.data.items;
        var uris = '';
        for (let i = 0; i < tracks_data.length; i++) {
            uris += tracks_data[i].uri;
            if (i != tracks_data.length - 1) {
                uris += ',';
            }
        }
        // AJOUT DES 10 TITRES D'UN USER DANS LA PLAYLIST CREEE

        const response_MDR = await axios.post('	https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?uris=' + uris, {}
            , {
                headers: {
                    "Authorization": "Bearer " + token
                }
            });

    }

    res.send(JSON.stringify("Operation reussi"));
});

app.listen(3000, () => {
    console.log("Server listening...")
});


