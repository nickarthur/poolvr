
// On iOS, use screen dimensions to determine iPhone/iPad model.
var userAgent = navigator.userAgent || navigator.vendor || window.opera;

// Check both width and height since the phone may be in landscape.
var width = screen.availWidth;
var height = screen.availHeight;
var pixelWidth = width * window.devicePixelRatio;
var pixelHeight = height * window.devicePixelRatio;

pyserver.log("hello from cardboard.js");
pyserver.log(userAgent);
if (navigator.getVRDevices) {
    navigator.getVRDevices().then(function (devices) {
        devices.forEach(function (device, i) {
            pyserver.log('VR device ' + i + ': ' + device.deviceName);
        });
    });
}

WebVRConfig = {
    //FORCE_ENABLE_VR: true,
    FORCE_DISTORTION: true
};
