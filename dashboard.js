// UI Controller


var controller = function () {

    // Earth radius in nm, 360*60/(2*Pi);
    var radius =  3437.74683
    var sailNames = [0, "Jib", "Spi", "Staysail", "Light Jib", "Code0", "Heavy Gnk", "Light Gnk", 8, 9, "Auto", "Jib(Auto)", "Spi(Auto)", "Staysail(Auto)", "Light Jib(Auto)", "Code0(Auto)", "Heavy Gnk(Auto)", "Light Gnk(Auto)"];

    var selRace, cbRouter, cbReuseTab;
    var lbBoatname;
    var divPositionInfo, divRecordLog, divRawLog;
    var callUrlFunction;

    // ToDo: clear stats if user/boat changes
    var currentUserId;
    var requests = new Map();
    var legInfos;
    
    // Polars and other game parameters, indexed by polar._id
    var polars =  [];

    function addSelOption(legInfo) {
        var id = legId(legInfo);
        var oldOption = selRace.options.namedItem(id);
        if (!oldOption) {
            var option = document.createElement("option");
            option.id = id;
            option.text = legInfo.legName;
            option.value = id;
            selRace.appendChild(option);
        }
    }

    var tableHeader =  "<tr>"
        + "<th>" + "Time" + "</th>"
        + "<th>" + "Position" + "</th>"
        + "<th>" + "Heading" + "</th>"
        + "<th>" + "TWS" + "</th>"
        + "<th>" + "TWD" + "</th>"
        + "<th>" + "TWA" + "</th>"
        + "<th>" + "vR (kn)" + "</th>"
        + "<th>" + "vC (kn)" + "</th>"
        + "<th>" + "vT (kn)" + "</th>"
        + "<th>" + "Δd (nm)" + "</th>"
        + "<th>" + "Δt (sec)" + "</th>"
        + "<th>" + "AutoSail" + "</th>"
        + "<th>" + "AutoTWA" + "</th>"
        + "<th>" + "Sail chng" + "</th>"
        + "<th>" + "Gybing" + "</th>"
        + "<th>" + "Tacking" + "</th>"
        +  "</tr>";

    var raceStatusHeader =  "<tr>"
        + "<th>" + "Race" + "</th>"
        + "<th>" + "Rank" + "</th>"
        + "<th>" + "Position" + "</th>"
        + "<th>" + "Heading" + "</th>"
        + "<th>" + "TWS" + "</th>"
        + "<th>" + "TWD" + "</th>"
        + "<th>" + "TWA" + "</th>"
        + "<th>" + "Boat speed" + "</th>"
        + "<th>" + "AutoTWA" + "</th>"
        + "<th>" + "DTF" + "</th>"
        + "<th>" + "Options" + "</th>"
        + "<th>" + "Cards" + "</th>"
        + "<th>" + "Sail" + "</th>" // red if badsail
        + "<th>" + "gnd" + "</th>"
        + "<th>" + "stlt" + "</th>"
        + "<th>" + "slow" + "</th>"
        + "<th>" + "Last Command" + "</th>"
        +  "</tr>";
   
    function printLastCommand(lcActions) {
        var lastCommand = "";
            
        lcActions.map( function (action) {
            if ( action.type == "heading" ) {
                lastCommand +=  (action.autoTwa?" TWA":" Heading") + '=' + roundTo(action.value, 1);
            } else if ( action.type == "sail" ) {
                lastCommand += ' Sail=' + sailNames[action.value];
            } else if ( action.type == "prog" ) {
                action.values.map(function ( progCmd ) {
                    var progTime = new Date(progCmd.ts).toJSON().substring(0,19);
                    lastCommand += (progCmd.autoTwa?" TWA":" Heading") + "=" + roundTo(progCmd.heading, 1) + ' @ ' + progTime + "; ";
                });
            } else if ( action.type == "wp" ) {
                action.values.map(function (waypoint) {
                    lastCommand += " WP: " + formatPosition(waypoint.lat, waypoint.lon) + "; ";
                });
            }
        });
        return lastCommand;
    }

    function makeRaceStatusLine (pair) {

        var race = pair[1];
        if ( race.curr == undefined ) {
            return "";
        } else {

            var autoSail = race.curr.tsEndOfAutoSail - race.curr.lastCalcDate;
            if ( autoSail < 0 ) {
                autoSail = '-';
            } else {
                autoSail = new Date(autoSail).toJSON().substring(11,19);
            }

            var sailNameBG = race.curr.badSail?"red":"lightgreen";
            var agroundBG = race.curr.aground?"red":"lightgreen";

            var manoeuvering = (race.curr.tsEndOfSailChange  > race.curr.lastCalcDate)
                || (race.curr.tsEndOfGybe  > race.curr.lastCalcDate)
                || (race.curr.tsEndOfTack > race.curr.lastCalcDate);

            var lastCommand = "";
            var lastCommandBG = "white";
            if ( race.lastCommand != undefined ) {
                // ToDo: error handling; multiple commands; expiring?
                var lcTime = new Date(race.lastCommand.request.ts).toJSON().substring(11,19);
                lastCommand = printLastCommand(race.lastCommand.request.actions);
                lastCommand = "T: " + lcTime + ' Actions:' + lastCommand;
                if ( race.lastCommand.rc != "ok" ) {
                    lastCommandBG = 'red';
                }
            }

            var cards = "";
            var showCards = ["PR","WP"];
  //          for ( var key in race.curr.cards ) {
            for ( var key in showCards) {
                cards =  cards + " " + showCards[key] + ":" + race.curr.cards[showCards[key]];
            }

            var twaFG = (race.curr.twa < 0)?"red":"green";
            
            return "<tr>"
                + "<td>" + race.legName + "</td>"
                + "<td>" + ((race.rank)?race.rank:"-") + "</td>"
                + "<td>" + formatPosition(race.curr.pos.lat, race.curr.pos.lon) + "</td>"
                + "<td>" + roundTo(race.curr.heading, 1) + "</td>"
                + "<td>" + roundTo(race.curr.tws, 1) + "</td>"
                + "<td>" + roundTo(race.curr.twd, 1) + "</td>"
                + "<td style=\"color:" + twaFG + ";\">" + roundTo(Math.abs(race.curr.twa), 1) + "</td>"
                + "<td>" + roundTo(race.curr.speed, 2) + "</td>"
                + "<td>" + (race.curr.twaAuto?"yes":"no") + "</td>"
                + "<td>" + roundTo(race.curr.distanceToEnd, 1) + "</td>"
                + "<td>" + ((race.curr.options.length == 8)?'Full':race.curr.options) + "</td>"
                + "<td>" + cards + "</td>"
                + "<td style=\"background-color:" + sailNameBG + ";\">" + sailNames[race.curr.sail] + "</td>"
                + "<td style=\"background-color:" + agroundBG +  ";\">" + ((race.curr.aground)?"AGROUND":"no") + "</td>"
                + "<td>" + ((race.curr.stealthMode > race.curr.lastCalcDate)?"yes":"no") + "</td>"
                + "<td>" + (manoeuvering?"yes":"no") + "</td>"
                + "<td style=\"background-color:" + lastCommandBG +  ";\">" + lastCommand + "</td>"
                + "</tr>";
        }
    }

    function makeRaceStatusHTML () {
        return "<table style=\"width:100%\">"
            + raceStatusHeader
            + Array.from(legInfos||[]).map(makeRaceStatusLine).join(' ');
            + "</table>";
    }

    function makeTableHTML (race) {
        return "<table style=\"width:100%\">"
            + tableHeader
            + (race === undefined?"":race.tableLines.join(' '))
            + "</table>";
    }

    function formatSeconds (value) {
        if ( value < 0 ) {
            return "-";
        } else {
            return roundTo(value/1000, 0);
        }
    }
        
    function addTableCommandLine(race) {
        race.tableLines.unshift(
          "<tr>"
        + "<td>" + new Date(race.lastCommand.request.ts).toGMTString() + "</td>" 
        + '<td colspan="2">Command @' + new Date().toJSON().substring(11,19) + "</td>" 
        + '<td colspan="13">Actions:' + printLastCommand(race.lastCommand.request.actions) + "</td>" 
        + "</tr>");
        if (race.raceId == selRace.value) {
            divRecordLog.innerHTML = makeTableHTML(race);
        }
    }
    
    function makeTableLine (race) {

        var autoSail = race.curr.tsEndOfAutoSail - race.curr.lastCalcDate;
        if ( autoSail < 0 ) {
            autoSail = '-';
        } else {
            autoSail = new Date(autoSail).toJSON().substring(11,19);
        }

        var sailChange = formatSeconds(race.curr.tsEndOfSailChange - race.curr.lastCalcDate);
        var gybing = formatSeconds(race.curr.tsEndOfGybe - race.curr.lastCalcDate);
        var tacking = formatSeconds(race.curr.tsEndOfTack - race.curr.lastCalcDate);

        var twaFG = (race.curr.twa < 0)?"red":"green";

        return "<tr>"
            + "<td>" + new Date(race.curr.lastCalcDate).toGMTString() + "</td>"
            + "<td>" + formatPosition(race.curr.pos.lat, race.curr.pos.lon) + "</td>"
            + "<td>" + roundTo(race.curr.heading, 1) + "</td>"
            + "<td>" + roundTo(race.curr.tws, 1) + "</td>"
            + "<td>" + roundTo(race.curr.twd, 1) + "</td>"
            + "<td style=\"color:" + twaFG + ";\">" + roundTo(Math.abs(race.curr.twa), 1) + "</td>"
            + "<td>" + roundTo(race.curr.speed, 2) + "</td>"
            + "<td>" + roundTo(race.curr.speedC, 2) + "</td>"
            + "<td>" + race.curr.speedT + "</td>"
            + "<td>" + roundTo(race.curr.deltaD, 2) + "</td>"
            + "<td>" + roundTo(race.curr.deltaT, 0) + "</td>"
            + "<td>" + autoSail + "</td>"
            + "<td>" + (race.curr.twaAuto?"yes":"no") + "</td>"
            + "<td>" + sailChange + "</td>"
            + "<td>" + gybing + "</td>"
            + "<td>" + tacking + "</td>"
            + "</tr>";
    }

    function saveMessage (race) {
        var newRow = makeTableLine(race);
        race.tableLines.unshift(newRow);
        if (legId(race) == selRace.value) {
            divRecordLog.innerHTML = makeTableHTML(race);
        }
    }

    function changeRace() {
        divRecordLog.innerHTML = makeTableHTML(legInfos.get(this.value));
    }

    function getLegId (id) {
        return id.race_id + '.' + id.leg_num;
    }
    
    function updateRace (message) {
        var race = legInfos.get(getLegId(message._id));
        if (race.curr !== undefined && race.curr.lastCalcDate == message.lastCalcDate) {
            // repeated message
            return;
        }
        race.prev = race.curr;
        race.curr = message;
        race.curr.speedT =  theoreticalSpeed(message);
        if ( race.prev != undefined ) {
            race.curr.deltaD = gcDistance(race.prev.pos.lat, race.prev.pos.lon, race.curr.pos.lat, race.curr.pos.lon);
            // Epoch timestamps are milliseconds since 00:00:00 UTC on 1 January 1970.
            race.curr.deltaT = (race.curr.lastCalcDate - race.prev.lastCalcDate)/1000;
            race.curr.speedC = roundTo(race.curr.deltaD/race.curr.deltaT * 3600, 2);
            saveMessage(race);
        }
        divRaceStatus.innerHTML = makeRaceStatusHTML();
    }

    function theoreticalSpeed (message) {
        var boatPolars = polars[message.boat.polar_id];
        if ( boatPolars == undefined ) {
            return '-';
        } else {
            var tws = message.tws;
            var twd = message.twd;
            var twa = message.twa;
            var options = message.options;
            var foil = foilingFactor(options, tws, twa, boatPolars.foil);
            var hull = options.includes("hull")?1.003:1.0;
            var twsLookup = fractionStep(tws, boatPolars.tws);
            var twaLookup = fractionStep(twa, boatPolars.twa);
            var speed = maxSpeed(options, twsLookup, twaLookup, boatPolars.sail);
            return ' ' + roundTo(speed.speed * foil * hull, 2) + '(' + speed.sail + ')';
        }
    }

    function maxSpeed (options, iS, iA, sailDefs) {
        var maxSpeed = 0;
        var maxSail = "";
        for (const sailDef of sailDefs) {
            if ( sailDef.name === "JIB"
                 || sailDef.name === "SPI"
                 || (sailDef.name === "STAYSAIL" && options.includes("heavy"))
                 || (sailDef.name === "LIGHT_JIB" && options.includes("light"))
                 || (sailDef.name === "CODE_0" && options.includes("reach"))
                 || (sailDef.name === "HEAVY_GNK" && options.includes("heavy"))
                 || (sailDef.name === "LIGHT_GNK" && options.includes("light")) ) {
                var speeds = sailDef.speed;
                var speed = bilinear(iA.fraction, iS.fraction,
                                     speeds[iA.index - 1][iS.index - 1],
                                     speeds[iA.index][iS.index - 1],
                                     speeds[iA.index - 1][iS.index],
                                     speeds[iA.index][iS.index]);
                if ( speed > maxSpeed ) {
                    maxSpeed = speed;
                    maxSail = sailDef.name;
                }
            }
        }
        return {
            speed: maxSpeed,
            sail: maxSail
        }
    }

    function bilinear (x, y, f00, f10, f01, f11) {
        return f00 * (1 - x) * (1 - y)
            + f10 * x * (1 - y)
            + f01 * (1 - x) * y
            + f11 * x * y;
    }

    function foilingFactor (options, tws, twa, foil) {
        var speedSteps = [0, foil.twsMin - foil.twsMerge, foil.twsMin, foil.twsMax,  foil.twsMax + foil.twsMerge, Infinity];
        var twaSteps = [0, foil.twaMin - foil.twaMerge, foil.twaMin, foil.twaMax,  foil.twaMax + foil.twaMerge, Infinity];
        var foilMat = [[1, 1, 1, 1, 1, 1],
                       [1, 1, 1, 1, 1, 1],
                       [1, 1, foil.speedRatio, foil.speedRatio, 1, 1],
                       [1, 1, foil.speedRatio, foil.speedRatio, 1, 1],
                       [1, 1, 1, 1, 1, 1],
                       [1, 1, 1, 1, 1, 1]];
        
        if ( options.includes("foil") ) {
            var iS = fractionStep(tws, speedSteps);
            var iA = fractionStep(twa, twaSteps);
            return  bilinear(iA.fraction, iS.fraction,
                             foilMat[iA.index - 1][iS.index - 1],
                             foilMat[iA.index][iS.index - 1],
                             foilMat[iA.index - 1][iS.index],
                             foilMat[iA.index][iS.index]);
        } else {
            return 1.0;
        }
    }
    
    function fractionStep (value, steps) {
        var absVal = Math.abs(value);
        var index = 0;
        while ( index < steps.length && steps[index]<= absVal ) {
            index++;
        }
        return {
            index: index,
            fraction: (absVal - steps[index-1]) / (steps[index] - steps[index-1])
        }
    }
    
    function callUrlZezo (raceId, beta) {
        var baseURL = 'http://zezo.org';
        var race = legInfos.get(raceId); 
        var urlBeta = race.url + (beta?"b":"");

        var url = baseURL + '/' + urlBeta + '/chart.pl?lat=' + race.curr.pos.lat + '&lon=' + race.curr.pos.lon;
        window.open(url, cbReuseTab.checked?urlBeta:'_blank');
    }
    
    function callUrlVH (raceId, beta) {
        // http://aguas-10:8080/vh?forecastbundle=NOAA-BUNDLE&starttime=NIL&polars=clipper_70_v2&foils=false&polish=false&fastmanoeuvres=false&minwind=true&duration=24&searchangle=90&angleincrement=2&pointsperisochrone=300
        var baseURL = 'http://aguas-10:8080/vh';
        var race = legInfos.get(raceId); 
        var url = baseURL + '?race=' + raceId
            + '&polars=' + polars[race.curr.boat.polar_id].label.split("/")[1]
            + '&options=' + race.curr.options
            + '&startlat=' + race.curr.pos.lat
            + '&startlon=' + race.curr.pos.lon
            + '&destlat=' + race.end.lat
            + '&destlon=' + race.end.lon;
        window.open(url, cbReuseTab.checked?url:'_blank');
    }
    
    // Greate circle distance in meters
    function gcDistance (lat0, lon0, lat1, lon1) {
        // e = r · arccos(sin(φA) · sin(φB) + cos(φA) · cos(φB) · cos(λB – λA))
        var rlat0 = toRad(lat0);
        var rlat1 = toRad(lat1);
        var rlon0 = toRad(lon0);
        var rlon1 = toRad(lon1);
        return radius * Math.acos(Math.sin(rlat0) * Math.sin(rlat1)
                                  + Math.cos(rlat0) * Math.cos(rlat1) * Math.cos(rlon1 - rlon0));
    }

    function toRad (angle) {
        return angle / 180 * Math.PI;
    }
    
    function toDeg (number) {
        var u = sign(number);
        number = Math.abs(number);
        var g = Math.floor(number);
        var frac = number - g;
        var m = Math.floor(frac * 60);
        frac = frac - m/60;
        var s = Math.floor(frac * 3600);
        var cs = roundTo(360000 * (frac - s/3600), 0);
        while ( cs >= 100 ) {
            cs = cs - 100;
            s = s + 1;
        }
        return {"u":u, "g":g, "m":m, "s":s, "cs":cs};
    }
    
    function roundTo (number, digits) {
        var scale = Math.pow(10, digits);
        return Math.round(number * scale) / scale;
    }

    function sign (x) {
        return (x < 0)? -1: 1;
    }

    function formatPosition (lat, lon) {
        var latDMS = toDeg(lat);
        var lonDMS = toDeg(lon);
        var latString = latDMS.g + "°" + latDMS.m + "'" + latDMS.s + "\"";
        var lonString = lonDMS.g + "°" + lonDMS.m + "'" + lonDMS.s + "\"";
        return  latString + ((latDMS.u==1)?'N':'S') + ' ' + lonString + ((lonDMS.u==1)?'E':'W');
    }

    var initialize = function () {
        var manifest = chrome.runtime.getManifest();
        document.getElementById("lb_version").innerHTML = manifest.version;

        lbBoatname = document.getElementById("lb_boatname");
        selRace = document.getElementById("sel_race");
        cbRouter = document.getElementById("auto_router");
        cbReuseTab = document.getElementById("reuse_tab");
        divRaceStatus = document.getElementById("raceStatus");
        divRaceStatus.innerHTML = makeRaceStatusHTML();
        divRecordLog = document.getElementById("recordlog");
        divRecordLog.innerHTML = makeTableHTML();
        cbRawLog =  document.getElementById("cb_rawlog");
        divRawLog = document.getElementById("rawlog");
        callUrlFunction = callUrlVH;
        chrome.storage.local.get("polars", function (items) {
            if ( items["polars"] != undefined ) {
                polars = items["polars"];
                console.log("Retrieved " + items["polars"].filter(function(value) { return value != null }).length + " polars."); 
            }
        });
    }
    
    var callUrl = function (raceId) {
        if (typeof raceId === "object") {
            // button event
            raceId = selRace.value;
        }
        var race = legInfos.get(raceId);
        if( race.curr === undefined ) {
            alert('No position received yet. Please retry later.');
        } else if ( callUrlFunction === undefined ) {
            alert("Don't know how to call router");
        } else {
            callUrlFunction(raceId);
        }
    }

    function reInitUI (newId) {
        if ( currentUserId != undefined && currentUserId != newId ) {
            // Re-initialize statistics
            races = new Map();
            divRaceStatus.innerHTML = makeRaceStatusHTML();
            divRecordLog.innerHTML = makeTableHTML();
        };
    }

    function legId(legInfo) {
        return legInfo.raceId + '.' + legInfo.legNum;
    }

    function createLegInfos(res) {
        legInfos = new Map();
        res.map(function (legInfo) {
            legInfo.tableLines = [];
            legInfos.set(legId(legInfo), legInfo);
            addSelOption(legInfo);
        });
        divRaceStatus.innerHTML = makeRaceStatusHTML();
    }

    var onEvent = function (debuggeeId, message, params) {
        if ( tabId != debuggeeId.tabId )
            return;

        if ( message == "Network.webSocketFrameSent" ) {
            // Append message to raw log
            if ( cbRawLog.checked ) {
                divRawLog.innerHTML = divRawLog.innerHTML + '\n' + '>>> ' + params.response.payloadData;
            }

            // Map to request type via requestId
            var request = JSON.parse(params.response.payloadData.replace(/\bNaN\b/g, "null"));
            requests.set(request.requestId, request);
            
        } else if ( message == "Network.webSocketFrameReceived" ) {
            // Append message to raw log
            if ( cbRawLog.checked ) {
                divRawLog.innerHTML = divRawLog.innerHTML + '\n' +  '<<< ' + params.response.payloadData;
            }
            
            var response = JSON.parse(params.response.payloadData.replace(/\bNaN\b/g, "null"));
            if ( response == undefined ) {
                console.log("Invalid JSON in payload");
            } else {
                var responseClass = response["@class"];
                if ( responseClass == ".AuthenticationResponse" ) {
                    reInitUI(response.userId);
                    currentUserId = response.userId;
                    lbBoatname.innerHTML = response.displayName;
                } else if ( responseClass == ".LogEventResponse" ) {
                    // Get the matching request and Dispatch on request type
                    var request = requests.get(response.requestId);
                    
                    // Dispatch on request type                 
                    if ( request == undefined ) {
                        // Probably only when debugging.
                        // -- save and process later?
                        console.warn(responseClass + " " + response.requestId + " not found");
                    } else if ( request.eventKey == "LDB_GetLegRank" ) {
                        // Use this response to update User/Boat info if the plugin is switched on while already logged in
                        if ( currentUserId == undefined ) {
                            currentUserId = response.scriptData.me._id;
                        }
                        if ( currentUserId !== response.scriptData.me._id ) {
                            alert("Unexpected user");
                        } else {
                            lbBoatname.innerHTML = response.scriptData.me.displayName;
                            // Retrieve rank in current race
                            var race = legInfos.get(getLegId(request));
                            if ( race != undefined ) {
                                race.rank = response.scriptData.me.rank;
                                divRaceStatus.innerHTML = makeRaceStatusHTML();
                            }
                        }
                    } else if ( request.eventKey == "Leg_GetList" ) {
                        // Contains destination coords, ice limits
                        // ToDo: contains Bad Sail warnings. Show in race status table?
                        if (!legInfos) {
                            createLegInfos(response.scriptData.res);
                        }
                        chrome.storage.local.set({"legInfos": Array.from(legInfos)}); 
                    } else if ( request.eventKey == "Game_GetBoatState" ) {
                        // First boat state message, only sent for the race the UI is displaying
                        var raceId = getLegId(response.scriptData.boatState._id);
                        updateRace(response.scriptData.boatState);
                        if (cbRouter.checked) {
                            callUrl(raceId);
                        }
                    } else if ( request.eventKey == "Game_AddBoatAction" ) {
                        // First boat state message, only sent for the race the UI is displaying
                        var raceId = getLegId(request);
                        var race = legInfos.get(raceId);
                        if ( race != undefined ) {
                            race.lastCommand = {request: request, rc: response.scriptData.rc};
                            addTableCommandLine(race);
                            divRaceStatus.innerHTML = makeRaceStatusHTML();
                        }
                    } else if ( request.eventKey == "Meta_GetPolar" ) {
                        if ( polars[response.scriptData.polar._id] == undefined ) {
                            polars[response.scriptData.polar._id] = response.scriptData.polar;
                            chrome.storage.local.set({"polars": polars});
                            console.info("Stored new polars " + response.scriptData.polar.label);
                        } else {
                            console.info("Known polars " + response.scriptData.polar.label);
                        }
                    }
                } else if ( responseClass == ".ScriptMessage" ) {
                    // There is no request for .ScriptMessages.
                    // The only ScriptMessage type is extCode=boatStatePush
                    updateRace(response.data);
                }
            }
        }
    }

    return {
        // The only point of initialize is to wait until the document is constructed.
        initialize: initialize,
        // Useful functions
        callUrl: callUrl,
        changeRace: changeRace,
        onEvent: onEvent
    }
} ();


var tabId = parseInt(window.location.search.substring(1));


window.addEventListener("load", function() {

    controller.initialize();
    
    document.getElementById("bt_callurl").addEventListener("click", controller.callUrl);
    document.getElementById("sel_race").addEventListener("change", controller.changeRace);
    
    chrome.debugger.sendCommand({tabId:tabId}, "Network.enable", function() {
        // just close the dashboard window if debugger attach fails
        // wodks on session restore too
        
        if (chrome.runtime.lastError) {
            window.close();
            return;
        }
    });
    chrome.debugger.onEvent.addListener(controller.onEvent);
});

window.addEventListener("unload", function() {
    chrome.debugger.detach({tabId:tabId});
});
