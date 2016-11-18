"use strict";

var machinomy = require("../index"),
    web3 = machinomy.web3;

var claim = function (storage, contract, paymentChannel) {
    var channelId = paymentChannel.channelId;
    storage.lastPaymentDoc(channelId, function (err, paymentDoc) {
        var canClaim = contract.canClaim(channelId, paymentDoc.value, Number(paymentDoc.v), paymentDoc.r, paymentDoc.s);
        if (canClaim) {
            contract.claim(paymentChannel.receiver, paymentChannel.channelId, paymentDoc.value, Number(paymentDoc.v), paymentDoc.r, paymentDoc.s, function (error, value) {
                if (error) throw error;
                console.log("Claimed " + value + " out of " + paymentChannel.value + " from channel " + channelId);
            });
        } else {
            console.log("Can not claim " + paymentDoc.value + " from channel " + channelId);
        }
    });
};

var startSettle = function (settings, contract, paymentChannel) {
    var canStartSettle = contract.canStartSettle(settings.account, paymentChannel.channelId);
    if (canStartSettle) {
        contract.startSettle(settings.account, paymentChannel.channelId, paymentChannel.spent, function (error) {
            if (error) throw error;
            console.log("Start settling channel " + paymentChannel.channelId);
        });
    } else {
        console.log("Can not start settling channel " + paymentChannel.channelId);
    }
};

/**
 * @param {String} channelId
 * @param {Object} options
 */
var close = function (channelId, options) {
    var namespace = options.namespace || "sender";

    var settings = machinomy.configuration[namespace].call();

    web3.personal.unlockAccount(settings.account, settings.password, 1000);

    var transport = new machinomy.Transport();

    var storage = new machinomy.Storage(settings.databaseFile, namespace);
    var contract = machinomy.contract;

    storage.channelByChannelId(channelId, function (err, paymentChannel) {
        if (err) throw err;
        var state = contract.getState(channelId);
        switch(state) {
            case 0: // open
                console.log("Channel " + channelId + " is open");
                if (settings.account == paymentChannel.sender) {
                    startSettle(settings, contract, paymentChannel);
                } else if (settings.account == paymentChannel.receiver) {
                    claim(storage, contract, paymentChannel);
                }
                break;
            case 1: // settling
                console.log("Channel " + channelId + " is settling");
                if (settings.account == paymentChannel.sender) {
                    throw "FIXME";
                } else if (settings.account == paymentChannel.receiver) {
                    claim(storage, contract, paymentChannel);
                }
                break;
            case 2: // settled, nothing to do
                console.log("Channel " + channelId + " is settled");
                break;
            default:
                throw "Unsupported channel state: " + state;
        }
    });
};

module.exports = close;
