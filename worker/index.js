const keys = require('./keys'); //for connecting to redis
const redis = require('redis');

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy : () => 1000
});

//create a duplicate subscriber client //reason given in server/index.js 
const sub = redisClient.duplicate();

function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
}

//everytime this client gets a new message
//we pass-in in a callback function which will 
// have a channel and a message. We then calculate 
//the fib based on this messahe and insert into a hashset
// where the key is the message and the value is the 
//fib on that index
sub.on('message', (channel, message) => {
    redisClient.hset('values', message, fib(parseInt(message)));
});

//anytime someone insert new value into redis
// we get the value and toss then value back into
//the redis instance
sub.subscribe('insert');
