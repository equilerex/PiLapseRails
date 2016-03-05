"use strict";

angular.module("ngapp", [ "ngTouch", "ui.router", "ngMdIcons", "ngMaterial", "ngStorage" ])
// ngTouch is No Longer Supported by Angular-Material

.run(function($rootScope){
  /* Hijack Android Back Button (You Can Set Different Functions for Each View by Checking the $state.current)
  document.addEventListener("backbutton", function (e) {
      if($state.is('init')){
        navigator.app.exitApp();
      }  else{
        e.preventDefault();
      }
    }, false);*/
})
    .config(function($mdThemingProvider) {
      $mdThemingProvider.definePalette('PiLapseRailsTheme', {
        '50': '#e5f7f9',
        '100': '#a8e4ea',
        '200': '#2AA0AB',
        '300': '#42c4d0',
        '400': '#30b7c4',
        '500': '#2aa0ab',
        '600': '#248992',
        '700': '#1e727a',
        '800': '#185b61',
        '900': '#124449',
        'A100': '#e5f7f9',
        'A200': '#a8e4ea',
        'A400': '#30b7c4',
        'A700': '#1e727a',
        'contrastDefaultColor': 'light',
        'contrastDarkColors': '50 100 200 300 400 A100 A200 A400'
      });
      $mdThemingProvider.theme('default')
          .primaryPalette('PiLapseRailsTheme')
          .accentPalette('PiLapseRailsTheme', {
            'default': '200' // use shade 200 for default, and keep all other shades the same
          });
    })
