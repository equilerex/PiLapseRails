# PiLapseRails
Web app for controlling DIY raspberry time lapse rails

![screenshot](/samples/screen2.jpg?raw=true "screenshot")   ![screenshot](/samples/screen1.jpg?raw=true "screenshot")

[Hardware](/samples/circuit.jpg)

[shutter schematics](/samples/mosfet.jpg)

When looking into time lapse rails, i ran across I ran across [David Hunt's](http://www.davidhunt.ie/lapse-pi-touch-a-touchscreen-timelapse-controller/) post on building a diy version using raspberry Pi.
The article was quite nice with a lot of information on the hardware... i however did not want to buy an extra touch screen and running it through command line sounded pretty insane so i went on to a quest to do something about it :)
A couple of evenings later, there was a solution :) i've put together a little web app that runs on a nodeJS server on the PI which can then be accessed on your mobile device if it is sharing its wifi with the raspberry.
The connection between the web app (on the phone) and the server(on the pi) is done through websockets so its more or less real time which makes it fast and responsive.
The runtime logic is on the nodejs side so if you walk away or close the browser, the time lapse will keep on running and you just need to open the app again to regain control/feedback.

And since i also had hell of a time trying to piece the whole picture together (there information on david's post but you had to figure a lot of things out on your own) then i figured that i'd create a dumb down guide on the hardware as well which someone with barely any knowledge on the subject should be able to follow:
[http://blog.koivistik.com/pilapserails-raspberrypi-time-lapse-rails/](http://blog.koivistik.com/pilapserails-raspberrypi-time-lapse-rails/)
 

### Features
* Remembers settings across sessions
* Configure rail length (will limit the movement accordingly)
* Shots/time/inteval estimation & feedback
* configure a lapse by setting the direction, motor length & "wait" length
* bulb mode which lets you define shutter speed
* optional focus lenght
* loop (will keep on lapsing back and fourth on the rail)
* manual motor controls
* flip motor pins
* test shot

### Installing

* Get a [rasbian](https://www.raspberrypi.org/help/quick-start-guide/) installed on your raspberry
* connect to wifi/ethernet
* open up terminal (the black monitor icon) and enter  the following commands:
* in case its a fresh rasbian installation, get your os updated with:


```
sudo apt-get update //(in case its a fresh rasbian installation)
```

* install nodejs (server side BE language)

```
sudo apt-get install nodejs npm
```

* web framework for providing the frontend

```
sudo npm install -g express

```
* provides permission to use pins

```
git clone git://github.com/equilerex/quick2wire-gpio-admin-permission-fix
cd quick2wire-gpio-admin-permission-fix/
make
sudo make install
sudo adduser $USER gpio
cd ..
```

* get our actual project files

```
git clone git://github.com/equilerex/PiLapseRails
```

* install pi-gpio pin controller software... including it in the package.json didnt work so have to do it here

```
cd PiLapseRails/
npm install pi-gpio
```

* project setup (downloads all dependencies)

```
npm install
```


* In order to start the app every time you boot raspberry, we need to add it to the startup process:

```
cd ..
cd ..
cd ..
sudo nano etc/rc.local
//use arrows to move to the end of the file and on a line before "exit 0" type:
su pi -c 'node /home/pi/PiLapseRails/bin/www.js &'
//hit ctrl + o to save
//hit enter to confirm name
```

* reboot your raspberry

### Connecting to your mobile
    -make a tethered hotspot (portable wifi got-spot) on the phone which you'll be using
    -on pi, connect to that hotspot.
    -If you are at home and used the wifi for setting everything up, you might want to remove that wifi connection so the pi would always connect to the phone automatically
    -in terminal, write:

```
ifconfig
```

* somewhere around where it says wlan0, find the ip address listed behind "inet addr" mine for example was 192.168.43.80
* now go on your phone and type what you found in a browser of your choice and add :8080 to the end of it, so in my case, it was 192.168.43.80:8080
* You're done! have fun!

### Updating
 ```
 cd PiLapsRails/
 git pull
 *restart your pi*
 ```

### Author

**Joosep Kõivistik** - [homepage](https://koivistik.com) |  [blog](https://blog.koivistik.com)

### Nice to know
* Half of the "wait length" is used before the rail moves, the other after it stops to ensure most stable conditions
* Reset button is there in case the software screws up the saved settings (should be bug free but you never know!)
* wifi can ba a bitch since sometimes the pi just doesnt wanna automatically connect to your phone... might be good to look into making raspberry the hotspot/access point instead


## Acknowledgments

Big thanks to:
* [David Hunt](http://www.davidhunt.ie/lapse-pi-touch-a-touchscreen-timelapse-controller/) for good write-up on the hardware and inspiration for the project
* [Donald Derek](http://blog.donaldderek.com/2013/06/build-your-own-google-tv-using-raspberrypi-nodejs-and-socket-io/) for inspiration on the websocket approach
* Dad... thanks for the help on the hardware :)
* [pi-gpio](https://github.com/rakeshpai/pi-gpio)
