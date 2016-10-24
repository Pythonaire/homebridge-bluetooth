var Accessory, BluetoothService;
var Chalk = require('chalk');

module.exports = function (accessory, bluetoothService) {
  Accessory = accessory;
  BluetoothService = bluetoothService;

  return BluetoothAccessory;
};


function BluetoothAccessory(log, config) {
  this.log = log;

  if (!config.name) {
    throw new Error("Missing mandatory config 'name'");
  }
  this.name = config.name;
  this.prefix = Chalk.blue("[" + config.name + "]");

  if (!config.address) {
    throw new Error(this.prefix + " Missing mandatory config 'address'");
  }
  this.address = config.address;

  if (!config.services || !(config.services instanceof Array)) {
    throw new Error(this.prefix + " Missing mandatory config 'services'");
  }

  this.log.info(this.prefix, "Initialized | " + this.name + " - " + this.address);
  this.bluetoothServices = {};
  for (var serviceConfig of config.services) {
    var serviceUUID = trimUUID(serviceConfig.UUID);
    this.bluetoothServices[serviceUUID] = new BluetoothService(this.log, serviceConfig, this.prefix);
  }

  this.homebridgeAccessory = null;
  this.nobleAccessory = null;
}


BluetoothAccessory.prototype.connect = function (nobleAccessory, homebridgeAccessory) {
  this.log.info(this.prefix, "Connected | " + this.name + " - " + this.address);
  this.homebridgeAccessory = homebridgeAccessory;
  this.homebridgeAccessory.on('identify', this.identify.bind(this));
  this.homebridgeAccessory.updateReachability(true);

  this.nobleAccessory = nobleAccessory;
  this.nobleAccessory.on('disconnect', this.disconnect.bind(this));
  this.nobleAccessory.discoverServices([], this.discoverServices.bind(this));
};


BluetoothAccessory.prototype.discoverServices = function (error, nobleServices) {
  if (error) {
    this.log.error(this.prefix, "Discover services failed | " + error);
    return;
  }
  if (nobleServices.length == 0) {
    this.log.warn(this.prefix, "No services discovered");
    return;
  }

  for (var nobleService of nobleServices) {
    var serviceUUID = trimUUID(nobleService.uuid);
    var bluetoothService = this.bluetoothServices[serviceUUID];
    if (!bluetoothService) {
      this.log.info(this.prefix, "Ignored | Service - " + nobleService.uuid);
      continue;
    }

    var homebridgeService = this.homebridgeAccessory.getService(bluetoothService.class);
    if (!homebridgeService) {
      homebridgeService = this.homebridgeAccessory.addService(bluetoothService.class, bluetoothService.name);
    }
    bluetoothService.connect(nobleService, homebridgeService);
  }
};


BluetoothAccessory.prototype.identify = function (paired, callback) {
  this.log.info(this.prefix, "Identify | " + paired);
  /*  if (this.nobleAccessory) {
   this.alertCharacteristic.write(new Buffer([0x02]), true);
   setTimeout(function() {
   this.alertCharacteristic.write(new Buffer([0x00]), true);
   }.bind(this), 250);
   callback();
   } else {
   callback(new Error("not connected"));
   } */
  callback();
};


BluetoothAccessory.prototype.disconnect = function (error) {
  if (error) {
    this.log.error("Disconnecting failed | " + this.name + " - " + this.address + " | " + error);
  }

  for (var serviceUUID in this.bluetoothServices) {
    this.bluetoothServices[serviceUUID].disconnect();
  }
  if (this.nobleAccessory && this.homebridgeAccessory) {
    this.homebridgeAccessory.removeAllListeners('identify');
    this.homebridgeAccessory.updateReachability(false);
    this.nobleAccessory.removeAllListeners('disconnect');
    this.homebridgeAccessory = null;
    this.nobleAccessory = null;
    this.log.info(this.prefix, "Disconnected");
  }
};


function trimUUID(uuid) {
  return uuid.toLowerCase().replace(/:/g, "").replace(/-/g, "");
}