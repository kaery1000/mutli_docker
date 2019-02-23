const keys = require('./keys');


//express app setup------------------------
const express = require('express');

//parse incoming request from the react app
// and turn the body of the post request into json object
const bodyParser = require('body-parser');

//cross origin resource sharing
// allow us to make request from one domain 
// that the react app be running on ,
// to different domain on which the express api are
//hosted on
const cors = require('cors'); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

//Postgress client setup------------------------
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(err => console.log(err));

//Redis client setup------------------------
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000 //in case connection to redis is lost, retry every 1 s
});

//according to the redis docs
//when we have a client which is listening/publishing info on the redis
// we need to make a duplicate connection because when a connection is used for
// listen/subscribe/publish it cannot be used for other purpose
const redisPublisher = redisClient.duplicate();

//express route handler------------------------
app.get('/', (req, res_) => {
    res.send('Hi');
});

//this handler is used to query running pg instance and retrive past values submitted to redis
app.get('/values/all', async (req, res) => { 
    const values = await pgClient.query('SELECT * FROM values');

    //becoz values has other info about the query, we just need the rows returned
    res.send(values.rows);
});

//this handler will query the redis instance
app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => { //we dont have await when using node with redis. no promise support. so we just use callbacks
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;
     
    if(parseInt(index) > 40) {
        return res.status(422).send('Index value too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index); // here we send an insert event. THis gonna wakeup the worker which will then start processing.
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working: true});

});

app.listen(5000, err => {
    console.log('Listening');
});

