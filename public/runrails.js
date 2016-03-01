var Gpio = require('onoff').Gpio,
    led = new Gpio(17, 'out'),
    sleep = require('sleep'),
    _baseTime = 128000, //micro seconds
    sleepTime = _baseTime,
    btwCodes = _baseTime * 2,
    btwLetters = _baseTime * 4,
    btwWords = _baseTime * 8;


var text = (process.argv[2] ? process.argv[2] : '').toLowerCase();

var MorseCode = {
    pattern: {
        'a': '._',
        'b': '_...',
        'c': '_._.',
        'd': '_..',
        'e': '.',
        'f': '.._.',
        'g': '__.',
        'h': '....',
        'i': '..',
        'j': '.___',
        'k': '_._',
        'l': '._..',
        'm': '__',
        'n': '_.',
        'o': '___',
        'p': '.__.',
        'q': '__._',
        'r': '._.',
        's': '...',
        't': '_',
        'u': '.._',
        'v': '..._',
        'w': '.__',
        'x': '_.._',
        'y': '_.__',
        'z': '__..',
        '1': '.____',
        '2': '..___',
        '3': '...__',
        '4': '...._',
        '5': '.....',
        '6': '_....',
        '7': '__...',
        '8': '___..',
        '9': '____.',
        '0': '_____'
    },
    active: function(t) {
        led.writeSync(1);
    },
    inactive: function() {
        led.writeSync(0);
    }
}

var _t = text.split('');

for(var i = 0; i < _t.length; i++) {
    var _l = _t[i];

    if(_l == ' ') { // if the char is a space
        sleep.usleep(btwWords);
    }
    else {
        var _c = MorseCode.pattern[_l].split('');
        sleep.usleep(btwLetters);
        console.log('Letter Starts >> ', _l);
        for(var j = 0; j < _c.length; j++) {
            console.log("code >> ", _c[j]);
            MorseCode.active();
            if(_c[j] == '.') {
                sleep.usleep(sleepTime);
                MorseCode.inactive();
                sleep.usleep(btwCodes);
            }
            else {
                sleep.usleep(sleepTime * 3);
                MorseCode.inactive();
                sleep.usleep(btwCodes);
            }
        }
    }
};