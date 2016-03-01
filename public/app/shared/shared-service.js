"use strict";

angular.module("ngapp").service("shared", function(){ // One of The Ways To Share Informations Across the Controllers
    this.info = {
        title: "Raspberry pi Timelaps Rail",
        auth: "koivistik.com"
    };
});
