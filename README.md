# PiLapseRails
Web app for controlling DIY raspberry timelapse rails

- screenshots


When looking into time lapse rails, i ran across I ran across [David Hunt's](http://www.davidhunt.ie/lapse-pi-touch-a-touchscreen-timelapse-controller/) post on building your own.
the article was quite nice with a lot of information on building it... i however did not want to buy an extra touch screen and running it through command line sounded pretty insane so i went on to a quest to do something about it :)
A couple of evenings later, there is a solution :) ive put together a little web app by running a nodeJS server on the PI which can then be accessed on your mobile device if you provide a pi with wifi from it.
the connection between the web app and the server is done through websockets so its fast and responsive. the runtime logic is on the nodejs side so if you walk away or close the browser, the imelapse will keep on running and you just need to open the app again to regain control/feedback.

and since i also had hell of a time trying to piece the whole picture together (there was information but you had to figure out a lot of things on your own) then i figured that i'd create a dumbed down guide on the hardware as well that someone with barely any knowledge on the subject should be able to follow:
 - link to blog (in progress)




### Features
- Remembers settings across sessions
- Configure rail length (will limit the movement accordingly)
- Shots/time/inteval estimation & feedback
- configure a lapse by setting the direction, motor length & "wait" length
- bulb mode which lets you define shutter speed
- optional focus lenght
- loop (will keep on lapsing back and fourth on the rail)
- manual motor controls
- flip motor pins
- test shot

### Installing

-Get a [rasbian](https://www.raspberrypi.org/help/quick-start-guide/) installed on your PI
-connect to wifi/ethernet
-open up terminal (the black monitor icon) and enter  the following commands:
```
sudo apt-get update //(in case its a fresh rasbian installation)

sudo apt-get install nodejs npm // installs [nodejs](https://nodejs.org/en/) server
sudo npm install -g express // more server stuff
git clone git://github.com/equilerex/quick2wire-gpio-admin-permission-fix // provides permission to use pins
cd quick2wire-gpio-admin-permission-fix/
make
sudo make install
sudo adduser $USER gpio
cd ..
git clone git://github.com/equilerex/PiLapseRails // our actual project
cd PiLapseRails/
npm install gpio //pin controller software... including it in the package.json didnt work so hae to do it here
npm install
```
- In order to start the app every time you boot raspberry, we need to add it to the startup process:
```
cd ..
sudo nano etc/rc.local
use arrows to move to the end of the file and type:
su pi -c 'node /home/pi/PiLapseRails/bin/www.js < /dev/null &'
ctrl + o
enter to confirm
```
- reboot your raspberry

### Connecting to your mobile
make a tethered hotspot (portable wifi got-spot) on the phone you'll be using
on pi, connect to that hotspot. if you are at home and used the wifi for setting everything up, you might want to remove that wifi connection so the pi would always connect to the phone automatically
in terminal, write:
```
ifconfig
```
somewhere around where it says wlan0, find the ip address listed behind "inet addr" mine for example was 192.168.43.80
now go on your phone and type what you found and add :8080 to the end of it, so in my case, it was 192.168.43.80

-Youre done! have fun!

## Author

* *Joosep Kõivistik** - [homepage](https://koivistik.com) |  [blog](https://blog.koivistik.com)

### Nice to know
- half of the "wait length" is used before the rail moves, the other after it stops to ensure most stable conditions
- reset button is there in case the software screws up the saved settings (should be bug free but you never know!)
-

## Acknowledgments

Big thanks to:
* [David Hunt](http://www.davidhunt.ie/lapse-pi-touch-a-touchscreen-timelapse-controller/) for good write-up on the hardware and inspiration for the project
* [Donald Derek](http://blog.donaldderek.com/2013/06/build-your-own-google-tv-using-raspberrypi-nodejs-and-socket-io/) for inspiration on the websocket approach
* Dad... thanks for the help on the hardware :)
* [pi-gpio](https://github.com/rakeshpai/pi-gpio)
