var interval,
    context = "settings",
    aboutMDpresent = false,
    hist,
    ships,
    paths = {},
    markers = {},
    ship_shape = {},
    map,
    basemaps = {},
    overlapmaps = {},
    station = {},
    shipsDB = {},
    fetch_binary = false,
    singleClickTimeout = null,
    server_message = "",
    show_all_tracks = false;
var iconLabelSpan = null,
    iconStationSpan = null,
    evtSource = null,
    evtSourceMap = null,
    range_outline = undefined,
    range_outline_short = undefined,
    tab_title_station = "",
    tab_title_count = null,
    tab_title = "AIS-catcher";

const baseMapSelector = document.getElementById("baseMapSelector");

var rtCount = 0;
var StationControlDiv = null;
var plugins = "",
    plugins_main = [];
var card_mmsi = null,
    hover_mmsi = null,
    build_string = "unknown";
var refreshIntervalMs = 2500;
var range_update_time = null;
let updateInProgress = false;
let activeTileLayer = undefined;
var
    marker_tracks = new Set(),
    marker_fireworks = [];

const hover_info = document.getElementById('hover-info');

let measures = [];

// default settings
var settings = {};
let isFetchingShips = false;

function restoreDefaultSettings() {
    settings = {
        counter: true,
        fading: false,
        android: false,
        welcome: true,
        latlon_in_dms: true,
        icon_scale: 1,
        track_weight: 1,
        show_range: false,
        distance_circles: true,
        distance_circle_color: '#1c71d8',
        map_day: "OpenStreetMap",
        map_overlay: [],
        map_night: "Dark Matter (no labels)",
        zoom: 10,
        lat: 0,
        lon: 0,
        tableside_column: "shipname",
        tableside_order: "ascending",
        range_timeframe: '24h',
        track_color: "#12a5ed",
        range_color: "#FFA500",
        range_color_short: "#FFDAB9",
        range_color_dark: "#4B4B4B",
        range_color_dark_short: "#303030",
        fix_center: false,
        center_point: "station",
        tooltipLabelColor: "#ffffff",
        tooltipLabelColorDark: "#ffffff",
        tooltipLabelShadowColor: "#000000",
        tooltipLabelShadowColorDark: "#000000",
        tooltipLabelFontSize: 9,
        shiphover_color: "#FFA500",
        shipselection_color: "#943b3e",
        shipoutline_border: "#A9A9A9",
        shipoutline_inner: "#808080",
        shipoutline_opacity: 0.9,
        show_circle_outline: false,
        dark_mode: false,
        center_radius: 0,
        show_station: true,
        metric: "DEFAULT",
        setcoord: true,
        tab: "stat",
        show_labels: "never",
        labels_declutter: true,
        eri: true,
        loadURL: true,
        map_opacity: 0.5
    };
}

function updateTitle() {
    document.title = (tab_title_count ? " (" + tab_title_count + ") " : "") + tab_title + " " + tab_title_station;
}

function applyDefaultSettings() {
    const t = settings.tab;

    let android = settings.android;
    let darkmode = settings.dark_mode;
    restoreDefaultSettings();
    settings.android = android;
    if (isAndroid()) settings.dark_mode = darkmode;

    updateSortMarkers();
    setLatLonInDMS(settings.latlon_in_dms);
    setDarkMode(settings.dark_mode);
    setMetrics(settings.metric);
    updateMapLayer();
    setFading(settings.fading);

    updateFocusMarker();
    removeDistanceCircles();

    settings.tab = t;
    settings.welcome = false;

    redrawMap();
}

// some functions useful in plugins
function addTileLayer(title, layer) {
    basemaps[title] = layer;
}

function removeTileLayer(title) {
    delete basemaps[title];
}
function removeTileLayerAll() {
    basemaps = {};
}
function addOverlayLayer(title, layer) {
    overlapmaps[title] = layer;
}
function removeOverlayLayer(title) {
    delete overlapmaps[title];
}
function removeOverlayLayerAll() {
    overlapmaps = {};
}
function addControlToMap(c) {
    c.addTo(map);
}

function decimalToDMS(l, isLatitude) {
    var degrees = Math.floor(Math.abs(l));
    var minutes = Math.floor((Math.abs(l) - degrees) * 60);
    var seconds = Number(((Math.abs(l) - degrees) * 60 - minutes) * 60).toFixed(1);
    var direction = isLatitude ? (l > 0 ? "N" : "S") : l > 0 ? "E" : "W";
    return degrees + "&deg" + minutes + "'" + seconds + '"' + direction;
}

// transformations - for overwrite
getDimVal = (c) => {
    return settings.metric === "DEFAULT" || settings.metric === "SI" ? Number(c).toFixed(0) : Number(c * 3.2808399).toFixed(0);
};

getDimUnit = () => {
    return settings.metric === "DEFAULT" || settings.metric === "SI" ? "m" : "ft";
};

getDistanceConversion = (c) => (settings.metric === "DEFAULT" ? c : settings.metric === "SI" ? c * 1.852 : c * 1.15078);
getDistanceVal = (c) => Number(getDistanceConversion(c)).toFixed(1);
getDistanceUnit = () => (settings.metric === "DEFAULT" ? "nmi" : settings.metric === "SI" ? "km" : "mi");
getSpeedVal = (c) => (settings.metric === "DEFAULT" ? Number(c).toFixed(1) : settings.metric === "SI" ? Number(c * 1.852).toFixed(1) : Number(c * 1.151).toFixed(1));
getSpeedUnit = () => (settings.metric === "DEFAULT" ? "kts" : settings.metric === "SI" ? "km/h" : "mph");

getLatValFormat = (ship) => (ship.approx ? "<i>" : "") + (settings.latlon_in_dms ? decimalToDMS(ship.lat, true) : Number(ship.lat).toFixed(5)) + (ship.approx ? "</i>" : "");
getLonValFormat = (ship) => (ship.approx ? "<i>" : "") + (settings.latlon_in_dms ? decimalToDMS(ship.lon, false) : Number(ship.lon).toFixed(5)) + (ship.approx ? "</i>" : "");

getEtaVal = (ship) => ("0" + ship.eta_month).slice(-2) + "-" + ("0" + ship.eta_day).slice(-2) + " " + ("0" + ship.eta_hour).slice(-2) + ":" + ("0" + ship.eta_minute).slice(-2);
getDeltaTimeVal = (s) => (s < 60 ? s + "s" : s < 60 * 60 ? Math.floor(s / 60) + "m " + (s % 60) + "s" : Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m");
getShipName = (ship) => ship.shipname;
getCallSign = (ship) => ship.callsign;
includeShip = (ship) => true;

const notificationContainer = document.getElementById("notification-container");

// https://stackoverflow.com/questions/51805395/navigator-clipboard-is-undefined
async function copyClipboard(t) {
    try {
        await copyToClipboard(t);
    } catch (error) {
        showDialog("Action", "No privilege for program to copy to the clipboard. Please select and copy (CTRL-C) the following string manually: " + t);
        return false;
    }
    return true;
}

async function copyToClipboard(textToCopy) {
    // Navigator clipboard api needs a secure context (https)
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
    } else {
        // Use the 'out of viewport hidden text area' trick
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;

        // Move textarea out of the viewport so it's not visible
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";

        document.body.prepend(textArea);
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (error) {
            console.error(error);
        } finally {
            textArea.remove();
        }
    }
}

function openSettings() {
    document.querySelector(".settings_window").classList.add("active");
}

function closeSettings() {
    document.querySelector(".settings_window").classList.remove("active");
}

function closeTableSide() {
    document.querySelector(".tableside_window").classList.remove("active");
}

function setLatLonInDMS(b) {
    settings.latlon_in_dms = b;
    saveSettings();

    refresh_data();
    if (table != null) table = null;
}

function copyCoordinates(m) {
    let coords = "not found";

    if (m in shipsDB) coords = shipsDB[m].raw.lat + "," + shipsDB[m].raw.lon;
    if (copyClipboard(coords)) showNotification("Coordinates copied to clipboard");
}

let hoverMMSI = undefined;

var rangeStyleFunction = function (feature) {
    let clr = undefined;

    if (feature.short) {
        clr = settings.dark_mode ? settings.range_color_dark_short : settings.range_color_short;
    } else {
        clr = settings.dark_mode ? settings.range_color_dark : settings.range_color;
    }
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: clr,
            width: 2
        })
    });
}

var shapeStyleFunction = function (feature) {

    const c = settings.shipoutline_inner;
    const o = settings.shipoutline_opacity;

    return new ol.style.Style({
        fill: new ol.style.Fill({
            color: `rgba(${parseInt(c.slice(-6, -4), 16)}, ${parseInt(c.slice(-4, -2), 16)}, ${parseInt(c.slice(-2), 16)}, ${o})`
        }),
        stroke: new ol.style.Stroke({
            color: hoverMMSI && feature.ship.mmsi == hoverMMSI ? settings.shiphover_color : settings.shipoutline_border,
            width: 2
        }),
    });
}

var trackStyleFunction = function (feature) {
    var w = Number(settings.track_weight);
    var c = settings.track_color;

    if (feature.mmsi == hoverMMSI) {
        c = settings.shiphover_color;
        w = w + 2;
    }
    if (feature.mmsi == card_mmsi) {
        c = settings.shipselection_color;
        w = w + 2;
    }

    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: c,
            width: w
        })
    });
}


var markerStyle = function (feature) {

    var length = (feature.ship.to_bow || 0) + (feature.ship.to_stern || 0);
    var mult = length >= 100 && length <= 200 ? 0.9 : length > 200 ? 1.1 : 0.75;

    return new ol.style.Style({
        image: new ol.style.Icon({
            src: SpritesAll,
            rotation: feature.ship.rot,
            offset: [feature.ship.cx, feature.ship.cy],
            size: [feature.ship.imgSize, feature.ship.imgSize],
            scale: settings.icon_scale * mult,
            opacity: 1
        })
    });
};

var labelStyle = function (feature) {
    const font = settings.tooltipLabelFontSize + "px Arial";
    return new ol.style.Style({
        text: new ol.style.Text({
            text: feature.ship.shipname || feature.ship.mmsi.toString(),
            overflow: true,
            offsetY: 25,
            offsetX: 25,
            fill: new ol.style.Fill({
                color: settings.dark_mode ? settings.tooltipLabelColorDark : settings.tooltipLabelColor
            }),
            stroke: new ol.style.Stroke({
                color: settings.dark_mode ? settings.tooltipLabelShadowColorDark : settings.tooltipLabelShadowColor,
                width: 5
            }),
            font: font
        })
    });
};

hoverCircleStyleFunction = function (feature) {
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 20,
            stroke: new ol.style.Stroke({
                color: settings.shiphover_color,
                width: 5
            })
        })
    });
}

selectCircleStyleFunction = function (feature) {
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 15,
            stroke: new ol.style.Stroke({
                color: settings.shipselection_color,
                width: 5
            })
        })
    });
}

var markerVector = new ol.source.Vector({
    features: []
})

var rangeVector = new ol.source.Vector({
    features: []
})

var shapeVector = new ol.source.Vector({
    features: []
});

var extraVector = new ol.source.Vector({
    features: []
});

var trackVector = new ol.source.Vector({
    features: []
});

var labelVector = new ol.source.Vector({
    features: []
});

var markerLayer = new ol.layer.Vector({
    source: markerVector,
    style: markerStyle
})

var shapeLayer = new ol.layer.Vector({
    source: shapeVector,
    style: shapeStyleFunction
});

var extraLayer = new ol.layer.Vector({
    source: extraVector
});

var trackLayer = new ol.layer.Vector({
    source: trackVector,
    style: trackStyleFunction
});

var rangeLayer = new ol.layer.Vector({
    source: rangeVector,
    style: rangeStyleFunction
});

var labelLayer = new ol.layer.Vector({
    source: labelVector,
    style: labelStyle,
    declutter: settings.labels_declutter || true
});

const measureSource = new ol.source.Vector();

const measureStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'green',
        lineDash: [20, 20],
        width: 2,
    })
});

const measureStyleWhite = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'white',
        lineDash: [20, 20],
        lineDashOffset: 20,
        width: 2,
    })
});

// label for the measure line
const measureLabelStyle = new ol.style.Style({
    text: new ol.style.Text({
        font: '14px Calibri,sans-serif',
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 1)',
        }),
        backgroundFill: new ol.style.Fill({
            color: 'green',
        }),
        padding: [3, 3, 3, 3],
        textBaseline: 'bottom',
        offsetY: -15,
    }),
});

const calculateBearing = function (start, end) {
    const startLat = toRadians(start[1]);
    const startLon = toRadians(start[0]);
    const endLat = toRadians(end[1]);
    const endLon = toRadians(end[0]);

    const dLon = endLon - startLon;
    const y = Math.sin(dLon) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);

    const bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360
};

const toRadians = function (degrees) {
    return degrees * Math.PI / 180;
};

const toDegrees = function (radians) {
    return radians * 180 / Math.PI;
};

const measureVector = new ol.layer.Vector({
    source: measureSource,
    style: function (feature) {
        return measureStyleFunction(feature);
    },
});

function measureStyleFunction(feature) {
    const styles = [];
    const geometry = feature.getGeometry();
    const type = geometry.getType();
    let point, label;
    if (type === 'LineString') {
        point = new ol.geom.Point(geometry.getLastCoordinate());
        label = `${feature.measureDistance} ${getDistanceUnit()}, ${feature.measureBearing} degrees`;
    }
    styles.push(measureStyle);
    styles.push(measureStyleWhite);
    if (label) {
        measureLabelStyle.setGeometry(point);
        measureLabelStyle.getText().setText(label);
        styles.push(measureLabelStyle);
    }
    return styles;
}

let shapeFeatures = {};
let markerFeatures = {};

let stationFeature = undefined;
let hoverCircleFeature = undefined;
let measureCircleFeature = undefined;
let selectCircleFeature = undefined;


async function fetchJSON(l, m) {
    try {
        response = await fetch(l + "?" + m);
    } catch (error) {
        showialog("Error", error);
    }
    return response.text();
}


// Function to create ship outline geometry in OpenLayers
function createShipOutlineGeometry(ship) {
    if (!ship) return null;
    const coordinate = [ship.lon, ship.lat];

    let heading = ship.heading;
    let { to_bow, to_stern, to_port, to_starboard } = ship;

    if (to_bow == null || to_stern == null || to_port == null || to_starboard == null) return null;

    if (heading == null) {
        if (ship.cog != null && ship.speed > 1) heading = ship.cog;
        else return new ol.geom.Circle(ol.proj.fromLonLat(coordinate), Math.max(to_bow, to_stern));
    }

    const deltaBow = calcOffset1M(coordinate, heading % 360);
    const deltaStarboard = calcOffset1M(coordinate, (heading + 90) % 360);

    const bow = calcMove(coordinate, deltaBow, to_bow);
    const stern = calcMove(coordinate, deltaBow, -to_stern);

    const A = calcMove(stern, deltaStarboard, to_starboard);
    const B = calcMove(stern, deltaStarboard, -to_port);
    const C = calcMove(B, deltaBow, 0.8 * (to_bow + to_stern));
    const Dmid = calcMove(C, deltaStarboard, 0.5 * (to_starboard + to_port));
    const D = calcMove(Dmid, deltaBow, 0.2 * (to_bow + to_stern));
    const E = calcMove(C, deltaStarboard, to_starboard + to_port);

    let shipOutlineCoords = [A, B, C, D, E, A].map(coord => ol.proj.fromLonLat(coord));
    return new ol.geom.Polygon([shipOutlineCoords]);
}

function showCommunity() {
    if (!communityFeed) {
        showDialog("Community feed is not available", "Enable by running with -X which will send your AIS data to aiscatcher.org and enable the options</br>Thank you for supporting AIS-catcher");
        return;
    }
}

async function showNMEA(m) {
    if (typeof message_save !== "undefined" && message_save) {
        const s = await fetchJSON("message", m);
        const obj = JSON.parse(s);

        let tableHtml = '<table class="mytable">';
        for (let key in obj) {
            let value = obj[key];
            if (Array.isArray(value)) {
                value = JSON.stringify(value).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');
            }
            tableHtml += "<tr><td>" + key + "</td><td oncontextmenu='showContextMenu(event,\"" + value + ' ",["settings","copy-text"])\'>' + value + "</td></tr>";
        }
        tableHtml += "</table>";

        showDialog("Message " + m, tableHtml);
    } else {
        showDialog("Error", 'Please enable "-N MSG on" in AIS-catcher settings.');
    }
}

async function showVesselDetail(m) {
    s = await fetchJSON("vessel", m);
    let obj = JSON.parse(s);

    let tableHtml = '<table class="mytable">';
    for (let key in obj) {
        tableHtml += "<tr><td>" + key + "</td><td>" + obj[key] + "</td></tr>";
    }
    tableHtml += "</table>";

    showDialog("Vessel " + m, tableHtml);
}

function copyText(m) {
    if (copyClipboard(m)) showNotification("Content copied to clipboard");
}

function openGoogleSearch(m) {
    window.open("https://www.google.com/search?q=" + m);
}

function openAIScatcherSite(m) {
    window.open("https://aiscatcher.org/ship/details/" + m);
}

function openMarineTraffic(m) {
    window.open(" https://www.marinetraffic.com/en/ais/details/ships/mmsi:" + m);
}

function openShipXplorer(m) {
    window.open("https://www.shipxplorer.com/data/vessels/IMO-MMSI-" + m);
}

function openVesselFinder(m) {
    window.open("https://www.vesselfinder.com/vessels/details/" + m);
}

function openAISHub(m) {
    window.open("https://www.aishub.net/vessels?Ship[mmsi]=" + m);
}

const mapMenu = document.getElementById("map-menu");

function hideMapMenu(event) {

    if (!mapMenu.contains(event.target)) {
        mapMenu.style.display = "none";
        document.removeEventListener("click", hideMapMenu);
    }
}

function showMapMenu(event) {

    hideContextMenu();
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }

    baseMapSelector.value = settings.dark_mode ? settings.map_night : settings.map_day;

    mapMenu.style.display = "block";

    mapMenu.style.left = "50%";
    mapMenu.style.top = "50%";
    mapMenu.style.transform = "translate(-50%, -50%)";

    document.addEventListener("click", function (event) {
        hideMapMenu(event);
    });
}

const contextMenu = document.getElementById("context-menu");

function hideContextMenu(event) {
    contextMenu.style.display = "none";
    document.removeEventListener("click", hideContextMenu);
}

function showContextMenu(event, mmsi, context) {

    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }

    hideMapMenu(event);

    document.getElementById("ctx_labelswitch").textContent = settings.show_labels != "never" ? "Hide ship labels" : "Show ship labels";
    document.getElementById("ctx_range").textContent = settings.show_range ? "Hide station range" : "Show station range";
    document.getElementById("ctx_fading").textContent = settings.fading ? "Show icons without fading" : "Show icons with fading";
    document.getElementById("ctx_fireworks").textContent = evtSourceMap == null ? "Start Fireworks Mode" : "Stop Fireworks Mode";

    context_mmsi = mmsi;

    const classList = ["station", "settings", "mmsi-map", "mmsi", "ctx-map", "copy-text", "table-menu"];

    classList.forEach((className) => {
        const shouldDisplay = context.includes(className);
        const elements = document.querySelectorAll("." + className);
        elements.forEach((element) => {
            element.style.display = shouldDisplay ? "flex" : "none";
        });
    });

    // we might have made non-android items visible in the context menu, so hide non-android items if needed
    updateAndroid();
    if (show_all_tracks) {
        document.querySelectorAll(".ctx-noalltracks").forEach(function (element) {
            element.style.display = "none";
        });
    }

    if (show_all_tracks || marker_tracks.size > 0) {
        document.querySelectorAll(".ctx-removealltracks").forEach(function (element) {
            element.style.display = "flex";
        });
    } else {
        document.querySelectorAll(".ctx-removealltracks").forEach(function (element) {
            element.style.display = "none";
        });
    }

    document.getElementById("ctx_menu_unpin").style.display = settings.fix_center && context.includes("ctx-map") ? "flex" : "none";
    document.getElementById("ctx_track").innerText = marker_tracks.has(Number(context_mmsi)) && context.includes("mmsi-map") ? "Hide Track" : "Show Track";

    contextMenu.style.display = "block";

    if (context.includes("center")) {
        contextMenu.style.left = "50%";
        contextMenu.style.top = "50%";
        contextMenu.style.transform = "translate(-50%, -50%)";
    } else {
        contextMenu.style.left = event.pageX + 5 + "px";
        contextMenu.style.top = event.pageY + 5 + "px";
        contextMenu.style.transform = "none";

        var contextMenuRect = contextMenu.getBoundingClientRect();
        var viewportWidth = window.innerWidth && window.outerWidth ? Math.min(window.innerWidth, window.outerWidth) : document.documentElement.clientWidth;
        var viewportHeight = window.innerHeight && window.outerHeight ? Math.min(window.innerHeight, window.outerHeight) : document.documentElement.clientHeight;

        var maxX = viewportWidth - contextMenuRect.width;
        var maxY = viewportHeight - contextMenuRect.height;

        var adjustedX = Math.max(0, Math.min(event.pageX + 5, maxX));
        var adjustedY = Math.max(0, Math.min(event.pageY + 5, maxY));

        contextMenu.style.left = adjustedX + "px";
        contextMenu.style.top = adjustedY + "px";
    }

    document.addEventListener("click", function (event) {
        hideContextMenu();
    });
}

function showDialog(title, message) {
    var dialogBox = document.getElementById("dialog-box");
    var dialogTitle = dialogBox.querySelector(".dialog-title");
    var dialogMessage = dialogBox.querySelector(".dialog-message");

    dialogTitle.innerText = title;
    dialogMessage.innerHTML = message;
    dialogBox.classList.remove("hidden");
}

function closeDialog() {
    var dialogBox = document.getElementById("dialog-box");
    dialogBox.classList.add("hidden");
}

function showNotification(message) {
    const notificationElement = document.createElement("div");
    notificationElement.classList.add("notification");
    notificationElement.textContent = message;

    notificationContainer.appendChild(notificationElement);

    setTimeout(() => {
        notificationElement.style.opacity = 0;
        setTimeout(() => {
            notificationContainer.removeChild(notificationElement);
        }, 500);
    }, 2000);
}

function getStatusVal(ship) {
    const StringFromStatus = [
        "Under way using engine",
        "At anchor",
        "Not under command",
        "Restricted manoeuverability",
        "Constrained",
        "Moored",
        "Aground",
        "Engaged in Fishing",
        "Under way sailing",
        "Reserved for HSC",
        "Reserved for WIG",
        "Reserved",
        "Reserved",
        "Reserved",
        "AIS-SART is active",
        "Not available",
    ];

    return StringFromStatus[Math.min(ship.status, 15)];
}

function getShipTypeVal(s) {
    if (s < 20) return "Not available";
    if (s <= 29) return "WIG";
    if (s <= 30) return "Fishing";
    if (s <= 32) return "Towing";
    if (s <= 34) return "Dredging/Diving ops";
    if (s <= 35) return "Military";
    if (s <= 36) return "Sailing";
    if (s <= 37) return "Pleasure Craft";
    if (s <= 39) return "Reserved";
    if (s <= 49) return "High Speed Craft";
    if (s <= 50) return "Pilot";
    if (s <= 51) return "Search And Rescue";
    if (s <= 52) return "Tug";
    if (s <= 53) return "Port tender";
    if (s <= 54) return "Anti-pollution equipment";
    if (s <= 55) return "Law Enforcement";
    if (s <= 57) return "Local Vessel";
    if (s <= 58) return "Medical Transport";
    if (s <= 59) return "Noncombatant ship";
    if (s <= 69) return "Passenger";
    if (s <= 79) return "Cargo";
    if (s <= 89) return "Tanker";
    if (s <= 99) return "Other";

    if ((s >= 1500 && s <= 1920) || (s >= 8000 && s <= 8510)) {
        switch (s) {
            case 8000:
                return "Unknown (inland AIS)";
            case 8010:
                return "Motor Freighter";
            case 8020:
                return "Motor Tanker";
            case 8021:
                return "Motor Tanker (liquid)";
            case 8022:
                return "Motor Tanker (liquid)";
            case 8023:
                return "Motor Tanker (dry)";
            case 8030:
                return "Container";
            case 8040:
                return "Gas Tanker";
            case 8050:
                return "Motor Freighter (tug)";
            case 8060:
                return "Motor Tanker (tug)";
            case 8070:
                return "Motor Freighter (alongside)";
            case 8080:
                return "Motor Freighter (with tanker)";
            case 8090:
                return "Motor Freighter (pushing)";
            case 8100:
                return "Motor Freighter (pushing)";
            case 8110:
                return "Tug, Freighter";
            case 8120:
                return "Tug, Tanker";
            case 8130:
                return "Tug Freighter (coupled)";
            case 8140:
                return "Tug, freighter/tanker";
            case 8150:
                return "Freightbarge";
            case 8160:
                return "Tankbarge";
            case 8161:
                return "Tankbarge (liquid)";
            case 8162:
                return "Tankbarge (liquid)";
            case 8163:
                return "Tankbarge (dry)";
            case 8170:
                return "Freightbarge (with containers)";
            case 8180:
                return "Tankbarge (gas)";
            case 8210:
                return "Pushtow (one cargo barge)";
            case 8220:
                return "Pushtow (two cargo barges)";
            case 8230:
                return "Pushtow, (three cargo barges)";
            case 8240:
                return "Pushtow (four cargo barges)";
            case 8250:
                return "Pushtow (five cargo barges)";
            case 8260:
                return "Pushtow (six cargo barges)";
            case 8270:
                return "Pushtow (seven cargo barges)";
            case 8280:
                return "Pushtow (eigth cargo barges)";
            case 8290:
                return "Pushtow (nine or more barges)";
            case 8310:
                return "Pushtow (one tank/gas barge)";
            case 8320:
                return "Pushtow (two barges)";
            case 8330:
                return "Pushtow (three barges)";
            case 8340:
                return "Pushtow (four barges)";
            case 8350:
                return "Pushtow (five barges)";
            case 8360:
                return "Pushtow (six barges)";
            case 8370:
                return "Pushtow (seven barges)";
            case 8380:
                return "Pushtow (eight barges)";
            case 8390:
                return "Pushtow (nine or more barges)";
            case 8400:
                return "Tug (single)";
            case 8410:
                return "Tug (one or more tows)";
            case 8420:
                return "Tug (assisting)";
            case 8430:
                return "Pushboat (single)";
            case 8440:
                return "Passenger";
            case 8441:
                return "Ferry";
            case 8442:
                return "Red Cross";
            case 8443:
                return "Cruise";
            case 8444:
                return "Passenger";
            case 8450:
                return "Service, Police or Port Service";
            case 8460:
                return "Maintainance Craft";
            case 8470:
                return "Object (towed)";
            case 8480:
                return "Fishing";
            case 8490:
                return "Bunkership";
            case 8500:
                return "Barge, Tanker, Chemical";
            case 8510:
                return "Object";
            case 1500:
                return "General";
            case 1510:
                return "Unit Carrier Maritime";
            case 1520:
                return "bulk Carrier Maritime";
            case 1530:
                return "Tanker";
            case 1540:
                return "Liquified Gas Tanker";
            case 1850:
                return "Pleasure";
            case 1900:
                return "Fast Ship";
            case 1910:
                return "Hydrofoil";
            case 1920:
                return "Catamaran Fast";
        }
    }
    return "Unknown (" + s + ")";
}

const ShippingClass = {
    OTHER: 0,
    UNKNOWN: 1,
    CARGO: 2,
    B: 3,
    PASSENGER: 4,
    SPECIAL: 5,
    TANKER: 6,
    HIGHSPEED: 7,
    FISHING: 8,
    PLANE: 9,
    HELICOPTER: 10,
    STATION: 11,
    ATON: 12,
    SARTEPIRB: 13,
};

// MMSI types from AIS-catcher
const OTHER = 0;
const CLASS_A = 1;
const CLASS_B = 2;
const BASESTATION = 3;
const SAR = 4;
const SARTEPIRB = 5;
const ATON = 6;

function headerClick() {
    window.open("https://aiscatcher.org");
}

function removeTileLayer() {
    map.eachLayer(function (layer) {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });
}

function updateMapLayer() {

    if (activeTileLayer) {

        overlays = JSON.parse(JSON.stringify(settings.map_overlay));
        settings.map_overlay = JSON.parse(JSON.stringify(overlays));

        setMapOpacity();
        triggerMapLayer();
    }
}

function setMap(key) {
    if (settings.dark_mode)
        settings.map_night = key;
    else
        settings.map_day = key;

    triggerMapLayer();
    saveSettings();
}

function triggerMapLayer() {

    if (activeTileLayer)
        activeTileLayer.setVisible(false);

    if (settings.dark_mode) {
        activeTileLayer = settings.map_night in basemaps ? basemaps[settings.map_night] : basemaps[Object.keys(basemaps)[0]];

    } else {
        activeTileLayer = settings.map_day in basemaps ? basemaps[settings.map_day] : basemaps[Object.keys(basemaps)[0]];
    }

    activeTileLayer.setVisible(true);
    console.log("Map layer: " + activeTileLayer.get("title") + " visible: " + activeTileLayer.getMaxZoom() + " " + activeTileLayer.minZoom);

    if (settings.map_overlay.length > 0) {
        for (let i = 0; i < settings.map_overlay.length; i++) {
            if (settings.map_overlay[i] in overlapmaps)
                overlapmaps[settings.map_overlay[i]].setVisible(settings.map_overlay[i] in overlapmaps);
        }
    }

    var attributions = activeTileLayer.getSource().getAttributions();
    var mapAttributions = document.getElementById("map_attributions");
    if (typeof attributions === 'function') {
        var currentAttributions = attributions();
        mapAttributions.innerHTML = currentAttributions.join(', ');
    } else if (Array.isArray(attributions)) {
        mapAttributions.innerHTML = attributions.join(', ');
    }

}

var dynamicStyle = document.createElement("style");
document.head.appendChild(dynamicStyle);

function applyDynamicStyling() {
    let style = ``

    if (!isAndroid())
        style += `
            @media only screen and (min-width: 750px) {
                #menubar {
                    position: fixed;
                    top: 60px;
                    left: 10px;
                    right: 0;
                    width: 500px;
                    border: solid;
                    border-color: var(--menu-border-color);
                    border-radius: 20px;
                }
            }
            `;
    else style += " .settings_window { top: 72px; }\n";

    dynamicStyle.innerHTML = style;
}

function setMapOpacity() {
    for (let key in basemaps)
        basemaps[key].setOpacity(Number(settings.map_opacity));

    for (let key in overlapmaps)
        overlapmaps[key].setOpacity(Number(settings.map_opacity));
}

var clickTimeout = undefined;
let isMeasuring = false;
let measureMode = false;

function refreshMeasures() {
    measureSource.clear();

    const mapcardContent = document.getElementById('measurecardInner');
    mapcardContent.innerHTML = '';

    let content = '';

    measures = measures.filter(measure => {


        if ((measure.start_type == 'ship' && !(measure.start_value in shipsDB))) {
            showNotification('Ship out of range for measurement.');
            return false;
        }

        let sc = undefined, ss = undefined, from = undefined;
        if (measure.start_type == 'point') {
            sc = ol.proj.fromLonLat(measure.start_value);
            from = "point";
        } else {
            ss = shipsDB[measure.start_value].raw;
            sc = ol.proj.fromLonLat([shipsDB[measure.start_value].raw.lon, shipsDB[measure.start_value].raw.lat]);
            from = ss.shipname || ss.mmsi;
        }

        let ec = undefined, es = undefined, to = "";
        if ('end_type' in measure) {
            if (measure.end_type == 'point') {
                ec = ol.proj.fromLonLat(measure.end_value);
                to = "point";
            } else {
                es = shipsDB[measure.end_value].raw;
                ec = ol.proj.fromLonLat([shipsDB[measure.end_value].raw.lon, shipsDB[measure.end_value].raw.lat]);
                to = es.shipname || es.mmsi;
            }
        }

        let distance = 0, bearing = 0;

        if (sc && ec) {
            const geometry = new ol.geom.LineString([sc, ec]);

            const length = ol.sphere.getLength(geometry);
            distance = getDistanceVal(length / 1852);
            const coordinates = geometry.getCoordinates();
            const start = ol.proj.toLonLat(coordinates[0]);
            const end = ol.proj.toLonLat(coordinates[coordinates.length - 1]);
            bearing = calculateBearing(start, end).toFixed(0);

            if (measure.visible) {
                const feature = new ol.Feature(geometry);
                measureSource.addFeature(feature);
                feature.measureDistance = distance;
                feature.measureBearing = bearing;
            }
        }
        let icon = measure.visible ? 'visibility' : 'visibility_off';

        content += `<tr data-index="${measures.indexOf(measure)}"><td style="padding: 2px;"><i style="padding-left:2px" class="${icon}_icon visibility_icon"></i></td><td style="padding: 0px;"><i class="delete_icon"></i></td><td>${from}</td><td>${to}</td><td title="${distance} ${getDistanceUnit()}">${distance}</td><td title="${bearing} degrees">${bearing}</td></tr>`;

        return true;
    });

    mapcardContent.innerHTML = content;
}

document.addEventListener('DOMContentLoaded', () => {
    const mapcardContent = document.getElementById('measurecardInner');

    mapcardContent.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (row) {
            const measureIndex = row.getAttribute('data-index');
            if (event.target.classList.contains('visibility_icon')) {
                measures[measureIndex].visible = !measures[measureIndex].visible;
                refreshMeasures();
            } else if (event.target.classList.contains('delete_icon')) {
                measures.splice(measureIndex, 1);
                refreshMeasures();
            }
        }
    });

    refreshMeasures();
});

function startMeasurementAtPoint(t, v) {
    isMeasuring = true;
    measures.push({ start_value: v, start_type: t, visible: true });
    if (!measurecardVisible()) toggleMeasurecard();
    showNotification('Select end point or object');
    refreshMeasures();
    startMeasureMode();
}

function endMeasurement(t, v) {
    if (isMeasuring) {

        const lastMeasureIndex = measures.length - 1;
        measures[lastMeasureIndex] = {
            ...measures[lastMeasureIndex],
            end_value: v,
            end_type: t
        };

        isMeasuring = false;

        showNotification('Measurement added.');
        refreshMeasures();
        clearMeasureMode();
    }
}

function startMeasureMode() {
    measureMode = true;
    document.getElementById('map').classList.add('crosshair_cursor');
}

function clearMeasureMode() {
    measureMode = false;
    document.getElementById('map').classList.remove('crosshair_cursor');
}

function setMeasureMode() {
    measureMode = true;
    document.getElementById('map').classList.add('crosshair_cursor');
}

const handleClick = function (pixel, target, event) {
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        return;
    }

    const feature = target.closest('.ol-control') ? undefined : map.forEachFeatureAtPixel(pixel,
        function (feature) { if ('ship' in feature || 'link' in feature) { return feature; } }, { hitTolerance: 10 });

    let included = feature && 'ship' in feature && feature.ship.mmsi in shipsDB;

    if (event.originalEvent.ctrlKey || measureMode || isMeasuring) {
        measureMode = false;

        if (isMeasuring) {
            if (feature && 'ship' in feature && feature.ship.mmsi in shipsDB) {
                endMeasurement("ship", feature.ship.mmsi);
            }
            else {
                endMeasurement("point", ol.proj.toLonLat(map.getCoordinateFromPixel(pixel)));
            }
            return;
        }

        if (feature && 'ship' in feature && feature.ship.mmsi in shipsDB) {
            startMeasurementAtPoint("ship", feature.ship.mmsi);
            return;
        }
        else {
            startMeasurementAtPoint("point", ol.proj.toLonLat(map.getCoordinateFromPixel(pixel)));
        }

        return;
    }



    if (feature && 'link' in feature && !included) {
        window.open(feature.link, '_blank');
    }
    else if (feature && 'ship' in feature || included) {

        closeDialog();
        closeSettings();
        showShipcard(feature.ship.mmsi);
    }
    else {
        clickTimeout = setTimeout(function () {
            showShipcard(null);
            clickTimeout = null;
        }, 300);
    }
};

function initMap() {

    map = new ol.Map({

        target: 'map',
        view: new ol.View({
            center: ol.proj.fromLonLat([settings.lon || 0, settings.lat || 0]),
            zoom: settings.zoom || 6,
            enableRotation: false,
        }),
        controls: []
    })

    for (let [key, value] of Object.entries(basemaps)) {
        map.addLayer(value);
        value.setVisible(false);
    }

    for (let [key, value] of Object.entries(overlapmaps)) {
        map.addLayer(value);
        value.setVisible(false);
    }

    [rangeLayer, shapeLayer, trackLayer, markerLayer, labelLayer, extraLayer, measureVector].forEach(layer => {
        map.addLayer(layer);
    });

    triggerMapLayer();

    map.on('pointermove', function (evt) {
        if (evt.dragging) {
            stopHover();
            return;
        }
        const pixel = map.getEventPixel(evt.originalEvent);
        handlePointerMove(pixel, evt.originalEvent.target);
    });

    map.on('click', function (evt) {
        handleClick(evt.pixel, evt.originalEvent.target, evt);
    });

    map.on('moveend', function (evt) {
        debouncedSaveSettings();
        debouncedDrawMap();
        if (communityFeed)
            debounceUpdateCommunityFeed();
    });


    map.getTargetElement().addEventListener('pointerleave', function () {
        stopHover();
    });

    map.getTargetElement().addEventListener('contextmenu', function (evt) {

        const f = getFeature(map.getEventPixel(evt), map.getTargetElement())

        if (!f)
            showContextMenu(evt, 0, ['settings', 'ctx-map']);
        else if ('station' in f) {
            showContextMenu(evt, null, ["station"]);
        }
        else if ('ship' in f)
            showContextMenu(evt, f.ship.mmsi, ["mmsi", "mmsi-map"]);
    });

    baseMapSelector.innerHTML = '';

    Object.keys(basemaps).forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        baseMapSelector.appendChild(option);
    });
    baseMapSelector.value = settings.dark_mode ? settings.map_night : settings.map_day;

    baseMapSelector.addEventListener('change', function () { setMap(this.value); });

    const overlayContainer = document.getElementById('overlayContainer');

    Object.keys(overlapmaps).forEach(key => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = key;
        checkbox.name = key;
        checkbox.checked = settings.map_overlay.includes(key);

        const label = document.createElement('label');
        label.setAttribute('for', key);
        label.textContent = key;

        overlayContainer.appendChild(checkbox);
        overlayContainer.appendChild(label);

        overlayContainer.appendChild(document.createElement('br'));

        checkbox.addEventListener('change', function () {
            overlapmaps[key].setVisible(this.checked);

            if (this.checked) {
                if (!settings.map_overlay.includes(key)) {
                    settings.map_overlay.push(key);
                }
            } else {
                const index = settings.map_overlay.indexOf(key);
                if (index > -1) {
                    settings.map_overlay.splice(index, 1);
                }
            }
            saveSettings();
        });
    });

    setMapOpacity();
}

function toggleLabel() {
    if (settings.show_labels == "never") {
        settings.show_labels = "dynamic";
    } else
        settings.show_labels = "never";

    saveSettings();
    redrawMap();
}

function setMetrics(s) {
    if (s.toUpperCase() == "DEFAULT") settings.metric = "DEFAULT";
    else if (s.toUpperCase() == "METRIC") settings.metric = "SI";
    else if (s.toUpperCase() == "IMPERIAL") settings.metric = "IMPERIAL";
    else settings.metric = "DEFAULT";

    showNotification("Switched units to " + s);
    saveSettings();

    refresh_data();
    if (table != null) table = null;
}

function getMetrics() {
    if (settings.metric == "DEFAULT") return "Default";
    if (settings.metric == "SI") return "Metric";
    if (settings.metric == "IMPERIAL") return "Imperial";
    return "Default";
}

function addMarker(lat, lon, ch) {
    var latlon = ol.proj.fromLonLat([lon, lat]);
    var color = 'grey'; // Default color

    if (ch === "A") color = 'blue';
    if (ch === "B") color = 'red';

    var style = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 30,
            stroke: new ol.style.Stroke({
                color: color,
                width: 10
            }),
            fill: new ol.style.Fill({
                color: 'rgba(0,0,0,0)'
            })
        })
    });

    var marker = new ol.Feature({
        geometry: new ol.geom.Point(latlon),
    });

    marker.setStyle(style);
    extraVector.addFeature(marker);

    setTimeout(function () {
        extraVector.removeFeature(marker);
    }, 1000);

}

function ToggleFireworks() {
    if (evtSourceMap == null) StartFireworks();
    else StopFireworks();
}

function StartFireworks() {
    if (evtSourceMap == null) {
        if (typeof realtime_enabled === "undefined" || realtime_enabled === false) {
            showDialog("Error", "Cannot run Firework Mode. Please ensure that AIS-catcher is running with -N REALTIME on.");
            return;
        }

        evtSourceMap = new EventSource("signal");

        evtSourceMap.addEventListener(
            "nmea",
            function (e) {
                var jsonData = JSON.parse(e.data);

                if (jsonData.hasOwnProperty("channel") ** jsonData.hasOwnProperty("lat") && jsonData.hasOwnProperty("lon")) {
                    addMarker(jsonData.lat, jsonData.lon, jsonData.channel);
                }
            },
            false,
        );

        evtSourceMap.onerror = function (event) {
            StopFireworks();
            showDialog("Error", "Problem running Firework Mode, cannot reach server. Please ensure that AIS-catcher is running with -N REALTIME on.");
        };

        evtSourceMap.onopen = function (event) {
            showNotification("Fireworks Mode started");
            console.log("Fireworks connected");
        };
    }
}

function StopFireworks() {
    if (evtSourceMap != null) {
        showNotification("Fireworks Mode stopped");
        evtSourceMap.close();
        evtSourceMap = null;
    }
}

function updateMarkerCountTooltip() {
    if (shipsDB == null) {
        ["statcard_stationary", "statcard_moving", "statcard_class_b_stationary", "statcard_class_b_moving", "statcard_station", "statcard_aton", "statcard_heli", "statcard_sarte"].forEach(function (id) {
            document.getElementById(id).innerHTML = "";
        });

        return;
    }

    let cStationary = 0,
        cMoving = 0,
        cClassBstationary = 0,
        cClassBmoving = 0,
        cStation = 0,
        cAton = 0,
        cHeli = 0,
        cSarte = 0;

    for (let [key, m] of Object.entries(shipsDB)) {
        if (key in shipsDB) {
            let ship = shipsDB[key].raw;
            switch (ship.shipclass) {
                case ShippingClass.ATON:
                    cAton++;
                    break;
                case ShippingClass.PLANE:
                    cHeli++;
                    break;
                case ShippingClass.HELICOPTER:
                    cHeli++;
                    break;
                case ShippingClass.STATION:
                    cStation++;
                    break;
                case ShippingClass.SARTEPIRB:
                    cSarte++;
                    break;
                case ShippingClass.B:
                    if (ship.speed != null && ship.speed > 0.5) cClassBmoving++;
                    else cClassBstationary++;
                    break;
                default:
                    if (ship.speed != null && ship.speed > 0.5) cMoving++;
                    else cStationary++;
                    break;
            }
        }
    }

    flashNumber("statcard_stationary", cStationary);
    flashNumber("statcard_moving", cMoving);
    flashNumber("statcard_station", cStation);
    flashNumber("statcard_aton", cAton);
    flashNumber("statcard_heli", cHeli);
    flashNumber("statcard_sarte", cSarte);
    flashNumber("statcard_class_b_stationary", cClassBstationary);
    flashNumber("statcard_class_b_moving", cClassBmoving);
}

function updateTableSort(event) {
    const header = event.currentTarget;

    const column = header.getAttribute("data-column");
    const currentOrder = header.classList.contains("ascending") ? "ascending" : "descending";

    const newOrder = currentOrder === "descending" ? "ascending" : "descending";

    settings.tableside_column = column;
    settings.tableside_order = newOrder;

    saveSettings();
    updateSortMarkers();
    updateTablecard();
}

function updateSortMarkers() {
    const allHeaders = document.querySelectorAll("[data-column]");

    allHeaders.forEach((otherHeader) => {
        otherHeader.classList.remove("ascending");
        otherHeader.classList.remove("descending");

        if (otherHeader.getAttribute("data-column") === settings.tableside_column) {
            otherHeader.classList.add(settings.tableside_order);
        }
    });
}

function compareNumber(valueA, valueB) {
    if (valueA == null && valueB == null) return settings.tableside_order === "ascending" ? 1 : -1;
    if (valueA == null) return settings.tableside_order === "ascending" ? 1 : -1;
    if (valueB == null) return settings.tableside_order === "ascending" ? -1 : 1;
    return valueA - valueB;
}

function compareString(valueA, valueB) {
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;

    return (valueA + "").localeCompare(valueB + "");
}

document.getElementById('shipSearchSide').addEventListener('input', updateTablecard);

function updateTablecard() {
    if (!document.getElementById("tableside").classList.contains("active")) return;

    var tableBody = document.getElementById("tablecardBody");
    tableBody.innerHTML = "";

    if (shipsDB == null) return;

    let shipKeys = Object.keys(shipsDB);

    column = settings.tableside_column;
    order = settings.tableside_order;

    const sortFunctions = {
        flag: (a, b) => compareString(shipsDB[a].raw.country, shipsDB[b].raw.country),
        shipname: (a, b) => compareString(getShipName(shipsDB[a].raw), getShipName(shipsDB[b].raw)),
        distance: (a, b) => compareNumber(shipsDB[a].raw.distance, shipsDB[b].raw.distance),
        speed: (a, b) => compareNumber(shipsDB[a].raw.speed, shipsDB[b].raw.speed),
        type: (a, b) => compareNumber(shipsDB[a].raw.shipclass, shipsDB[b].raw.shipclass),
        last_signal: (a, b) => compareNumber(shipsDB[a].raw.last_signal, shipsDB[b].raw.last_signal),
    };

    if (column in sortFunctions) {
        shipKeys.sort((keyA, keyB) => {
            const comparisonResult = sortFunctions[column](keyA, keyB);
            return order === "ascending" ? comparisonResult : -comparisonResult;
        });
    }

    var filter = document.getElementById('shipSearchSide').value.toLowerCase();

    let addedRows = 0;

    for (let i = 0; i < shipKeys.length; i++) {
        if (addedRows > 100) break;

        let key = shipKeys[i];
        if (key in shipsDB) {
            let ship = shipsDB[key].raw;
            let shipName = String(getShipName(ship) || ship.mmsi);
            if (!filter || shipName.toLowerCase().includes(filter)) {
                var row = tableBody.insertRow();

                row.addEventListener("mouseover", function (e) {
                    startHover(ship.mmsi);
                });
                row.addEventListener("mouseout", function (e) {
                    stopHover();
                });
                row.addEventListener("click", function (e) {
                    showShipcard(ship.mmsi);
                });
                row.addEventListener("contextmenu", function (e) {
                    showContextMenu(event, ship.mmsi, ["mmsi", "mmsi-map"]);
                    sss
                });

                var cell1 = row.insertCell(0);
                cell1.innerHTML = getFlag(ship.country);

                var cell2 = row.insertCell(1);
                cell2.innerHTML = shipName;

                var cell3 = row.insertCell(2);
                cell3.innerHTML = ship.distance ? getDistanceVal(ship.distance) : "";
                cell3.title = ship.distance != null ? getDistanceVal(ship.distance) + " " + getDistanceUnit() : "";

                var cell4 = row.insertCell(3);
                cell4.innerHTML = ship.speed != null ? getSpeedVal(ship.speed) : "";
                cell4.title = ship.speed != null ? getSpeedVal(ship.speed) + " " + getSpeedUnit() : "";

                var cell5 = row.insertCell(4);
                cell5.innerHTML = ship != null ? "<span " + getIconCSS(ship) + "></span>" : "";

                var cell6 = row.insertCell(5);
                cell6.innerHTML = getDeltaTimeVal(ship.last_signal);
            }
        }
    }
}

function flashNumber(id, newValue) {

    const element = document.getElementById(id);
    const oldValue = parseInt(element.innerText) || 0;

    if (newValue != oldValue) {
        element.classList.add("flash-up");
    }

    element.innerText = newValue;

    setTimeout(() => {
        element.classList.remove("flash-up");
    }, 500);
}

function updateMarkerCount() {

    let count = 0;
    if (shipsDB != null) {
        count = Object.keys(shipsDB).length;
    }

    flashNumber("markerCount", count);

    if (document.getElementById("statcard").style.display == "block") updateMarkerCountTooltip();
}

function toggleStatcard() {
    if (document.getElementById("statcard").style.display == "block") hideStatcard();
    else showStatcard();
}

function showStatcard() {
    updateMarkerCountTooltip();
    document.getElementById("statcard").style.display = "block";
}

function hideStatcard() {
    document.getElementById("statcard").style.display = "none";
}

function toggleTablecard() {
    if (!document.getElementById("tableside").classList.contains("active") && window.innerWidth < 800) {
        settings.tab = "ships";
        selectTab();
        return;
    }

    document.getElementById("tableside").classList.toggle("active");
    var elements = document.querySelectorAll(".map-button-box");
    elements.forEach(function (element) {
        element.classList.toggle("active");
    });

    updateTablecard();
}

function hideTablecard() {
    if (document.getElementById("tableside").classList.contains("active")) {
        toggleTablecard();
    }
}

var isDragging = false;
var offsetX, offsetY, headerY;

var statcard = document.getElementById("statcard");

function startDrag(event) {
    var clientX = event.clientX || event.touches[0].clientX;
    var clientY = event.clientY || event.touches[0].clientY;

    isDragging = true;

    var boundingRect = statcard.getBoundingClientRect();

    const menubar = document.getElementById("menubar");
    const position = window.getComputedStyle(menubar).getPropertyValue("position");
    const menuHeight = position === "fixed" ? 0 : document.getElementById("menubar").offsetHeight;
    const headerHeight = document.getElementById("headerbar").offsetHeight;

    offsetX = clientX - boundingRect.left;
    offsetY = clientY - boundingRect.top;
    headerY = +menuHeight + headerHeight + 5;

    statcard.style.cursor = "grabbing";
    L.DomEvent.stopPropagation(event);
}

function moveDrag(event) {
    if (isDragging) {
        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;

        const viewportWidth = window.innerWidth && window.outerWidth ? Math.min(window.innerWidth, window.outerWidth) : document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight && window.outerHeight ? Math.min(window.innerHeight, window.outerHeight) : document.documentElement.clientHeight;

        var top = Math.max(0, Math.min(clientY - offsetY, viewportHeight - 10 - statcard.offsetHeight) - headerY);
        var left = Math.max(0, Math.min(clientX - offsetX, viewportWidth - 10 - statcard.offsetWidth));

        statcard.style.top = top + "px";
        statcard.style.left = left + "px";
        statcard.style.right = "auto";
    }
}

function endDrag(event) {
    isDragging = false;
    statcard.style.cursor = "auto";
}

statcard.addEventListener("mousedown", startDrag);
document.addEventListener("mousemove", moveDrag);
document.addEventListener("mouseup", endDrag);
document.addEventListener("mouseleave", endDrag);

statcard.addEventListener("touchstart", startDrag);
document.addEventListener("touchmove", moveDrag);
document.addEventListener("touchend", endDrag);
document.addEventListener("touchcancel", endDrag);

function setRangeSwitch(b) {
    if (b != settings.show_range) {
        toggleRange();
    }
}

function setRangeColor(v, f) {
    settings[f] = v;
    redrawMap();
}

function setRangeTimePeriod(v) {
    settings.range_timeframe = v;
    saveSettings();
    fetchRange(true).then(() => drawRange());
}

async function toggleRange() {
    const isSationSet = station && station.hasOwnProperty("lat") && station.hasOwnProperty("lon") && !(station.lat == 0 && station.lon == 0);

    if (!(typeof param_share_loc != "undefined" && param_share_loc) || !isSationSet) {
        showDialog("Error", "Unable to show range as station location not available");
        settings.show_range = false;
    } else settings.show_range = !settings.show_range;

    saveSettings();

    await fetchRange();
    drawRange();
}

function setFading(b) {
    if (b != settings.fading) {
        toggleFading();
    }
}

function toggleFading() {
    settings.fading = !settings.fading;
}

function showPlugins() {
    showDialog("Plugins", "<pre>Loaded plugins:\n" + plugins + "</pre>");
}

function showServerErrors() {
    showDialog("Server Errors", server_message == "" ? "None" : ("<pre>" + server_message + "</pre>"));
}

async function fetchStatistics() {
    try {
        response = await fetch("stat.json");
    } catch (error) {
        setPulseError();
        return;
    }
    statistics = await response.json();
    setPulseOk();
    return statistics;
}

async function fetchAbout() {
    try {
        response = await fetch("about.md");
    } catch (error) {
        return;
    }
    aboutmd = await response.text();
    return aboutmd;
}

async function fetchRange(forcefetch = false) {
    const isSationSet = station && station.hasOwnProperty("lat") && station.hasOwnProperty("lon") && !(station.lat == 0 && station.lon == 0);

    if (!isSationSet || !settings.show_range) {
        settings.show_range = false;
        range_update_time = undefined;
        return;
    }

    const now = new Date();

    if (!forcefetch && range_update_time && Math.floor((now - range_update_time) / 1000 / 60) < 15) return;

    range_update_time = now;

    try {
        response = await fetch("history_full.json");
        h = await response.json();
    } catch (error) {
        settings.show_range = false;
        setPulseError();
        return;
    }

    setPulseOk();

    range_outline = [];
    range_outline_short = [];

    const N = h.day.stat[0].radar_a.length;

    const range = [];
    const range_short = [];

    for (let i = 0; i < N; i++) {
        let m = 0;
        for (j = 0; j < h.minute.stat.length; j++) {
            m = Math.max(m, h.minute.stat[j].radar_a[i]);
            m = Math.max(m, h.minute.stat[j].radar_b[i]);
        }

        range_short.push(m);

        for (j = 0; j < h.hour.stat.length; j++) {
            m = Math.max(m, h.hour.stat[j].radar_a[i]);
            m = Math.max(m, h.hour.stat[j].radar_b[i]);
        }

        const additionalDays = settings.range_timeframe == "7d" ? 7 : settings.range_timeframe == "30d" ? 30 : 0;

        for (j = 0; j < Math.min(additionalDays, h.day.stat.length); j++) {
            m = Math.max(m, h.day.stat[j].radar_a[i]);
            m = Math.max(m, h.day.stat[j].radar_b[i]);
        }

        range.push(m);
    }

    const deltaNorth = calcOffset1M([station.lon, station.lat], 0)[0];
    const deltaEast = calcOffset1M([station.lon, station.lat], 90)[1];

    for (let i = 0; i < N; i++) {
        range_outline.push([
            station.lon + ((range[i] * deltaEast * 1000) / 0.5399568) * Math.sin(((i * 2) / N) * Math.PI),
            station.lat + ((range[i] * deltaNorth * 1000) / 0.5399568) * Math.cos(((i * 2) / N) * Math.PI),
        ]);

        range_outline.push([
            station.lon + ((range[i] * deltaEast * 1000) / 0.5399568) * Math.sin((((i + 1) * 2) / N) * Math.PI),
            station.lat + ((range[i] * deltaNorth * 1000) / 0.5399568) * Math.cos((((i + 1) * 2) / N) * Math.PI),
        ]);

        range_outline_short.push([
            station.lon + ((range_short[i] * deltaEast * 1000) / 0.5399568) * Math.sin(((i * 2) / N) * Math.PI),
            station.lat + ((range_short[i] * deltaNorth * 1000) / 0.5399568) * Math.cos(((i * 2) / N) * Math.PI),
        ]);

        range_outline_short.push([
            station.lon + ((range_short[i] * deltaEast * 1000) / 0.5399568) * Math.sin((((i + 1) * 2) / N) * Math.PI),
            station.lat + ((range_short[i] * deltaNorth * 1000) / 0.5399568) * Math.cos((((i + 1) * 2) / N) * Math.PI),
        ]);
    }

    range_outline = range_outline.map(point => ol.proj.fromLonLat(point));
    range_outline_short = range_outline_short.map(point => 0 * ol.proj.fromLonLat(point));
}

let rangeFeature = undefined;
let rangeShortFeature = undefined;

function drawRange() {
    if (rangeFeature) {
        rangeVector.removeFeature(rangeFeature);
        rangeFeature = undefined;
    }

    if (rangeShortFeature) {
        rangeVector.removeFeature(rangeShortFeature);
        rangeShortFeature = undefined;
    }

    if (!settings.show_range) return;

    if (range_outline) {
        rangeFeature = new ol.Feature({
            geometry: new ol.geom.Polygon([range_outline])
        });

        rangeFeature.short = false;
        rangeFeature.tooltip = "Station Range " + settings.range_timeframe;
        rangeVector.addFeature(rangeFeature);
    }

    if (range_outline_short) {
        rangeShortFeature = new ol.Feature({
            geometry: new ol.geom.Polygon([range_outline_short])
        });

        rangeShortFeature.tooltip = "Station Range 1h";
        rangeShortFeature.short = true;
        rangeVector.addFeature(rangeShortFeature);
    }

}

var distanceFeatures = undefined;
var distanceLat = undefined;
var distanceLon = undefined;
var distanceMetric = undefined;

function removeDistanceCircles() {
    if (distanceFeatures) {
        for (var i = 0; i < distanceFeatures.length; i++)
            rangeVector.removeFeature(distanceFeatures[i]);
    }
    distanceFeatures = undefined;
}

function createDistanceGeometry(lat, lon, radius) {

    /*
    const center = ol.proj.fromLonLat([lon, lat]);
    const circle = new ol.geom.Circle(center, radius);
    return circle;
    */

    const deltaNorth = calcOffset1M([station.lon, station.lat], 0)[0];
    const deltaEast = calcOffset1M([station.lon, station.lat], 90)[1];
    const N = 50;

    let outline = [];
    for (let i = 0; i < N; i++) {
        outline.push([
            station.lon + ((radius * deltaEast)) * Math.sin(((i * 2) / N) * Math.PI),
            station.lat + ((radius * deltaNorth)) * Math.cos(((i * 2) / N) * Math.PI),
        ]);
    }

    outline = outline.map(point => ol.proj.fromLonLat(point));
    return new ol.geom.Polygon([outline]);
}

function updateDistanceCircles() {
    const lat = station.lat;
    const lon = station.lon;

    if (!settings.distance_circles) {
        removeDistanceCircles();
        return;
    }

    if (!lat || !lon) return;

    if (!distanceFeatures || distanceLat != lat || distanceLon != lon || distanceMetric != settings.metric) {

        removeDistanceCircles();

        distanceLat = lat;
        distanceLon = lon;
        distanceMetric = settings.metric;

        distanceFeatures = [];

        var greyLineStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: settings.distance_circle_color,
                width: 1
            })
        });

        const conv = settings.metric === "DEFAULT" ? 1.852 : settings.metric === "SI" ? 1 : 1.609344;

        const range = [5000, 10000, 25000, 50000, 100000];

        for (var i = 0; i < range.length; i++) {

            let distanceCircle = new ol.Feature({
                geometry: createDistanceGeometry(lat, lon, range[i] * conv)
            });

            distanceCircle.setStyle(greyLineStyle);
            distanceCircle.tooltip = range[i] / 1000 + " " + getDistanceUnit().toUpperCase();
            rangeVector.addFeature(distanceCircle);
            distanceFeatures.push(distanceCircle);
        }
    }
}

/*
let view_offset = 0;

function readUint8(view) {
const val = view.getUint8(view_offset);
view_offset += 1;
return val;
}

function readUint16(view) {
const val = view.getUint16(view_offset);
view_offset += 2;
return val;
}

function readUint32(view) {
const val = view.getUint32(view_offset);
view_offset += 4;
return val;
}

function readUint64(view) {
const high = readUint32(view);
const low = readUint32(view);
return high * 2 ** 32 + low;
}

function readInt8(view) {
const val = view.getInt8(view_offset);
view_offset += 1;
return val;
}

function readInt16(view) {
const val = view.getInt16(view_offset);
view_offset += 2;
return val;
}

function readInt32(view) {
const val = view.getInt32(view_offset);
view_offset += 4;
return val;
}

function readInt64(view) {
const high = readInt32(view);
const low = readUint32(view);
return high * 2 ** 32 + low;
}

function readString(view) {
const length = readUint8(view);
let str = "";
for (let i = 0; i < length; i++) {
    str += String.fromCharCode(readUint8(view));
}
return str;
}

function readFloat(view) {
return readInt16(view) / 1000.0;
}

function readFloatLow(view) {
return readInt16(view) / 10.0;
}

function readLatLon(view) {
const lat = readInt32(view) / 6000000.0;
const lon = readInt32(view) / 6000000.0;
return { lat, lon };
}

function deserialize(view, time) {
function setNullIf(value, condition) {
    if (value == condition) return null;
    return value;
}

function setNullIfLess(value, condition) {
    if (value < condition) return null;
    return value;
}

function setNullIfGreater(value, condition) {
    if (value > condition) return null;
    return value;
}

// Now, deserialize the Ship structure
const ship = {};
ship.mmsi = readUint32(view);
const latLon = readLatLon(view);
ship.lat = setNullIfGreater(latLon.lat, 90);
ship.lon = setNullIfGreater(latLon.lon, 180);
ship.distance = setNullIfLess(readFloatLow(view), 0);
ship.bearing = setNullIfLess(readFloatLow(view), 0);
ship.level = setNullIfGreater(readFloatLow(view), 1023);
ship.count = readInt16(view);
ship.ppm = setNullIfGreater(readFloatLow(view), 1023);

let approx_validated = readInt8(view);
ship.approx = (approx_validated & 1) == 1;
ship.validated = (approx_validated >> 1) & (1 == 1);

ship.heading = setNullIfGreater(readFloatLow(view), 510);
ship.cog = setNullIfGreater(readFloatLow(view), 359.9);
ship.speed = setNullIfLess(readFloatLow(view), 0);
ship.to_bow = setNullIf(readInt16(view), -1);
ship.to_stern = setNullIf(readInt16(view), -1);
ship.to_starboard = setNullIf(readInt16(view), -1);
ship.to_port = setNullIf(readInt16(view), -1);
ship.last_group = readUint64(view);
ship.group_mask = readUint64(view);
ship.shiptype = readInt16(view);

let shipclass_mmsitype = readUint8(view);
ship.shipclass = shipclass_mmsitype >> 4;
ship.mmsi_type = shipclass_mmsitype & 15;

ship.msg_type = readUint32(view);
ship.channels = readInt8(view);
ship.country = String.fromCharCode(readInt8(view), readInt8(view));
ship.status = readInt8(view);
ship.draught = setNullIfLess(readFloatLow(view), 0);

ship.eta_month = setNullIf(readInt8(view), 0);
ship.eta_day = setNullIf(readInt8(view), 0);
ship.eta_hour = setNullIf(readInt8(view), 24);
ship.eta_minute = setNullIf(readInt8(view), 60);

ship.imo = setNullIf(readInt32(view), 0);
ship.callsign = readString(view);
ship.shipname = readString(view);
ship.destination = readString(view);
ship.received = readUint64(view);
ship.last_signal = time - ship.received;

return ship;
}

async function fetchShipsBinary(noDoubleFetch = true) {
if (isFetchingShips && noDoubleFetch) {
    console.log("A fetch operation is already running.");
    return false;
}

let ships = {};
station = {};
let arrayBuffer;

isFetchingShips = true;
try {
    response = await fetch("sb");
    const blob = await response.blob();
    arrayBuffer = await blob.arrayBuffer();
} catch (error) {
    setPulseError();
    console.log("failed loading ships: " + error);
    return false;
} finally {
    isFetchingShips = false;
}

center = {};

setPulseOk();

shipsDB2 = {};
let view = new DataView(arrayBuffer);
view_offset = 0;

let time = readUint64(view);
let count = readInt32(view);

let hasstation = readInt8(view) == 1;
if (hasstation) {
    station = readLatLon(view);
    let own_mmsi = readUint32(view);
}

while (view_offset < view.byteLength) {
    const ship = deserialize(view, time);
    if (includeShip(ship)) {
        const entry = {};
        entry.raw = ship;
        shipsDB2[ship.mmsi] = entry;
    }
}

if (String(settings.center_point).toUpperCase() == "STATION") {
    center = station;
} else if (settings.center_point in shipsDB) {
    let ship = shipsDB[settings.center_point].raw;
    center = { lat: ship.lat, lon: ship.lon };
}

return true;
}
*/

async function fetchShips(noDoubleFetch = true) {
    if (isFetchingShips && noDoubleFetch) {
        console.log("A fetch operation is already running.");
        return false;
    }

    let ships = {};

    isFetchingShips = true;
    try {
        response = await fetch("ships_array.json");
    } catch (error) {
        setPulseError();
        console.log("failed loading ships: " + error);
        return false;
    } finally {
        isFetchingShips = false;
    }
    ships = await response.json();

    setPulseOk();

    const keys = [
        "mmsi",
        "lat",
        "lon",
        "distance",
        "bearing",
        "level",
        "count",
        "ppm",
        "approx",
        "heading",
        "cog",
        "speed",
        "to_bow",
        "to_stern",
        "to_starboard",
        "to_port",
        "last_group",
        "group_mask",
        "shiptype",
        "mmsi_type",
        "shipclass",
        "validated",
        "msg_type",
        "channels",
        "country",
        "status",
        "draught",
        "eta_month",
        "eta_day",
        "eta_hour",
        "eta_minute",
        "imo",
        "callsign",
        "shipname",
        "destination",
        "last_signal",
    ];

    shipsDB = {};
    station = {};

    ships.values.forEach((v) => {
        const s = Object.fromEntries(keys.map((k, i) => [k, v[i]]));

        if (includeShip(s)) {
            const entry = {};
            entry.raw = s;
            shipsDB[s.mmsi] = entry;
        }
    });

    if (ships.hasOwnProperty("station")) station = ships.station;

    center = {};
    if (String(settings.center_point).toUpperCase() == "STATION") {
        center = station;
    } else if (settings.center_point in shipsDB) {
        let ship = shipsDB[settings.center_point].raw;
        center = { lat: ship.lat, lon: ship.lon };
    }

    tab_title_count = ships.values.length;
    updateTitle();

    return true;
}

function toggleScreenSize() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen || docEl.webkitEnterFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen || doc.webkitExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

function addShipcardItem(icon, txt, title, onclick) {
    const div = document.createElement("div");

    div.title = title;
    if (icon.startsWith("fa")) {
        icon = "question_mark";
    }
    div.innerHTML = '<i class="' + icon + '_icon"></i><span>' + txt + "</span>";

    div.setAttribute("onclick", onclick);

    document.getElementById("shipcard_footer").appendChild(div);
}

function hideMenu() {
    if (document.getElementById("menubar").classList.contains("visible") && !isAndroid()) {
        toggleMenu();
    }
}

function showMenu() {
    if (!document.getElementById("menubar").classList.contains("visible")) {
        toggleMenu();
    }
}

function hideMenuifSmall() {
    hideMenu();
}

function toggleMenu() {
    document.getElementById("menubar").classList.toggle("visible");
    document.getElementById("menubar_mini").classList.toggle("showflex");
    document.getElementById("menubar_mini").classList.toggle("hide");

    var menuButton = document.getElementById("header_menu_button");
    menuButton.classList.toggle("menu_icon");
    menuButton.classList.toggle("close_icon");
}

function initFullScreen() {
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("msfullscreenchange", handleFullScreenChange);
}

function handleFullScreenChange() {
    var icon = document.getElementById("screentoggle-id");
    if (document.fullscreenElement) {
        icon.innerHTML = "fullscreen_exit";
    } else {
        icon.innerHTML = "fullscreen";
    }
}

// we calculate the lat/lon for 1m move in direction of heading
// underlying calculation uses an offset of 100m and then scales down to 1.

const cos100R = 0.9999999998770914; // cos(100m / R);
const sin100R = 1.567855942823164e-5; // sin(100m / R)
const rad = Math.PI / 180;
const radInv = 180 / Math.PI;


function calcOffset1M(coordinate, heading) {
    const lat = coordinate[1] * rad;
    const rheading = ((heading + 360) % 360) * rad;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    let sinLat2 = sinLat * cos100R + cosLat * sin100R * Math.cos(rheading);
    let lat2 = Math.asin(sinLat2);
    let deltaLon = Math.atan2(Math.sin(rheading) * sin100R * cosLat, cos100R - sinLat * sinLat2);

    return [(lat2 * radInv - coordinate[1]) / 100, (deltaLon * radInv) / 100];
}

function calcMove(coordinate, delta, distance) {
    return [coordinate[0] + delta[1] * distance, coordinate[1] + delta[0] * distance];
}

function setMapSetting(a, v) {
    settings[a] = v;
    saveSettings();
    redrawMap();
}

function average(d) {
    const b = d.chart.data.datasets[0].data;
    if (b.length == 1) return b[0].y;

    let start = 0;
    if (d.chart.data.datasets.length > 1) start = 1;

    var c = 0;
    for (a = 0; a < b.length; a++) {
        if (b[a].x != 0) {
            for (i = start; i < d.chart.data.datasets.length; i++) {
                c += d.chart.data.datasets[i].data[a].y;
            }
        }
    }
    return c / (b.length - 1);
}

const graph_annotation = {
    type: "line",
    borderColor: "rgba(12,118,170)",
    borderDash: [6, 6],
    borderDashOffset: 0,
    borderWidth: 3,
    scaleID: "y",
    value: (a) => average(a),
};

const graph_options_count = {
    responsive: true,
    plugins: {
        legend: {
            display: true,
        },
        annotation: {
            annotations: {
                graph_annotation,
            },
        },
    },
    elements: {
        point: {
            radius: 1,
        },
    },
    animation: false,
    tooltips: {
        mode: "index",
        intersect: false,
    },
    hover: {
        mode: "index",
        intersect: false,
    },
    scales: {
        y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
                display: true,
                align: 'center'  // Aligns tick labels
            },
            grid: {
                display: true,  // Only the primary axis should display grid lines
            },
            title: {
                display: true,
                text: 'Message Count',
                font: {
                    size: 12
                },
                color: '#666'
            }
        },
        y_right: {
            stacked: true,
            beginAtZero: true,
            ticks: {
                display: true,
                align: 'center'  // Aligns tick labels
            },
            grid: {
                display: false,  // Disable grid lines on the secondary axis
            },
            position: 'right',
            title: {
                display: true,
                text: 'Vessel Count',
                font: {
                    size: 12
                },
                color: '#666'
            }
        },
        x: {
            ticks: {
                display: true
            },
            title: {
                display: true,
                text: 'Time',
                font: {
                    size: 16
                },
                color: '#666'
            }
        },
    }

};

const graph_options_single = {
    responsive: true,
    plugins: {
        legend: {
            display: false,
        },
        annotation: {
            annotations: {
                graph_annotation,
            },
        },
    },
    elements: {
        point: {
            radius: 1,
        },
    },
    animation: false,
    tooltips: {
        mode: "index",
        intersect: false,
    },
    hover: {
        mode: "index",
        intersect: false,
    },
    scales: {
        y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
                display: true,
            },
        },
        x: {
            ticks: {
                display: true,
            },
        },
    },
};

const graph_options_level = {
    responsive: true,
    plugins: {
        legend: {
            display: false,
        },
    },
    elements: {
        point: {
            radius: 1,
        },
    },
    animation: false,
    tooltips: {
        mode: "index",
        intersect: false,
    },
    hover: {
        mode: "index",
        intersect: false,
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                display: true,
            },
        },
        x: {
            ticks: {
                display: true,
            },
        },
    },
};

const graph_options_distance = {
    responsive: true,
    plugins: {
        legend: {
            display: true,
        },
    },
    elements: {
        point: {
            radius: 1,
        },
    },
    animation: false,
    tooltips: {
        mode: "index",
        intersect: false,
    },
    hover: {
        mode: "index",
        intersect: false,
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                display: true,
            },
        },
        x: {
            ticks: {
                display: true,
            },
        },
    },
};

plot_count = {
    type: "scatter",
    data: {
        datasets: [
            {
                label: "Vessel Count",
                data: [],
                type: "line",
                showLine: true,
                fill: false,
                pointStyle: false,
                borderWidth: 2,
                yAxisID: 'y_right', // correctly reference the right y-axis
            },
            {
                label: "Class A",
                data: [],
                showLine: true,
                fill: "origin",
                borderWidth: 2,
                pointStyle: false,
            },
            {
                label: "Class B",
                data: [],
                showLine: true,
                fill: "-1",
                borderWidth: 2,
                pointStyle: false,
            },
            {
                label: "Base Station",
                data: [],
                showLine: true,
                fill: "-1",
                borderWidth: 2,
                pointStyle: false,
            },
            {
                label: "Other",
                data: [],
                showLine: true,
                fill: "-1",
                borderWidth: 2,
                pointStyle: false,
            },
        ],
    },
    options: graph_options_count,
};

plot_distance = {
    type: "scatter",
    data: {
        datasets: [
            {
                label: "NE",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 2,
            },
            {
                label: "SE",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 2,
            },
            {
                label: "SW",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 2,
            },
            {
                label: "NW",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 2,
            },
            {
                label: "Max",
                data: [],
                showLine: true,
                backgroundColor: "rgb(211,211,211,0.9)",
                fill: true,
                pointStyle: false,
                borderWidth: 0,
            },
        ],
    },
    options: graph_options_distance,
};

plot_single = {
    type: "scatter",
    data: {
        datasets: [
            {
                label: "Data",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 2,
            },
        ],
    },
    options: graph_options_single,
};

plot_level = {
    type: "scatter",
    data: {
        datasets: [
            {
                label: "Max",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 1,
            },
            {
                label: "Min",
                data: [],
                showLine: true,
                pointStyle: false,
                borderWidth: 1,
                fill: "-1",
            },
        ],
    },
    options: graph_options_level,
};

var plot_radar = {
    type: "polarArea",
    animation: false,
    responsive: true,
    plugins: {
        legend: {
            display: true,
        },
    },
    data: {
        datasets: [
            {
                label: "Class B",
                borderWidth: 1,
            },
            {
                label: "Class A",
                borderWidth: 1,
            },
        ],
    },
    options: {
        legend: {
            display: false,
        },
        scale: {
            ticks: {
                min: 0,
            },
        },
    },
};

function cssvar(name) {
    return getComputedStyle(document.body).getPropertyValue(name);
}

function updateChartColors(c, colorVariables) {
    c.data.datasets.forEach((dataset, index) => {
        const color = cssvar(colorVariables[index]);

        dataset.backgroundColor = color;
        dataset.borderColor = color;
    });

    c.options.scales.x.ticks.color = cssvar("--chart-color");
    c.options.scales.x.grid.color = cssvar("--chart-grid-color");

    c.options.scales.y.ticks.color = cssvar("--chart-color");
    c.options.scales.y.grid.color = cssvar("--chart-grid-color");

    c.options.plugins.legend.labels.color = cssvar("--chart-color");
}

function updateColorMulti(c) {
    const colorVariables = ["--chart4-color", "--chart1-color", "--chart2-color", "--chart5-color", "--chart6-color"];
    updateChartColors(c, colorVariables);
}

function updateColorSingle(c) {
    const colorVariables = ["--chart4-color", "--chart1-color", "--chart2-color", "--chart5-color", "--chart6-color"];
    updateChartColors(c, colorVariables);
}

function updateColorRadar(c) {
    const colorVariables = ["--chart2-color", "--chart4-color", "--chart2-color", "--chart5-color", "--chart4-color"];
    c.data.datasets.forEach((dataset, index) => {
        const color = cssvar(colorVariables[index]);

        dataset.backgroundColor = color;
        dataset.borderColor = color;
    });

    c.options.scales.r.grid.color = cssvar("--chart-grid-color");
    c.options.scales.r.ticks.color = cssvar("--chart-color");
    c.options.scales.r.ticks.backdropColor = cssvar("--panel-color");
}

function initPlots() {
    if (typeof Chart !== "undefined") {
        chart_radar_hour = new Chart(document.getElementById("chart-radar-hour").getContext("2d"), plot_radar);
        chart_radar_day = new Chart(document.getElementById("chart-radar-day").getContext("2d"), plot_radar);
        chart_seconds = new Chart(document.getElementById("chart-seconds"), plot_count);
        chart_minutes = new Chart(document.getElementById("chart-minutes"), plot_count);
        chart_hours = new Chart(document.getElementById("chart-hours"), plot_count);
        chart_days = new Chart(document.getElementById("chart-days"), plot_count);
        chart_ppm = new Chart(document.getElementById("chart-ppm"), plot_single);
        chart_ppm_minute = new Chart(document.getElementById("chart-ppm-minute"), plot_single);
        chart_level = new Chart(document.getElementById("chart-level"), plot_level);
        chart_distance_hour = new Chart(document.getElementById("chart-distance-hour"), plot_distance);
        chart_distance_day = new Chart(document.getElementById("chart-distance-day"), plot_distance);
        chart_minute_vessel = new Chart(document.getElementById("chart-vessels-minute"), plot_single);
    }
}

function shipcardismax() {
    return document.getElementById("shipcard").classList.contains("shipcard-ismax");
}

function shipcardselect(e) {
    if (shipcardismax()) {
        e.classList.toggle("shipcard-max-only");
        e.classList.toggle("shipcard-row-selected");
    } else toggleShipcardSize();

    saveSettings();
}

function toggleShipcardSize() {
    Array.from(document.getElementsByClassName("shipcard-min-only")).forEach((e) => e.classList.toggle("visible"));
    Array.from(document.getElementsByClassName("shipcard-max-only")).forEach((e) => e.classList.toggle("hide"));

    document.getElementById("shipcard").classList.toggle("shipcard-ismax");
    document.getElementById("shipcard_minmax_button").classList.toggle("keyboard_arrow_down_icon");
    document.getElementById("shipcard_minmax_button").classList.toggle("keyboard_arrow_up_icon");

    var e = document.getElementById("shipcard_content").children;

    if (shipcardismax()) {
        for (let i = 0; i < e.length; i++) {
            if (
                (e[i].classList.contains("shipcard-max-only") && e[i].classList.contains("shipcard-row-selected")) ||
                (!e[i].classList.contains("shipcard-max-only") && !e[i].classList.contains("shipcard-row-selected"))
            )
                e[i].classList.toggle("shipcard-row-selected");
        }
    } else {
        for (let i = 0; i < e.length; i++) {
            if (e[i].classList.contains("shipcard-row-selected")) e[i].classList.toggle("shipcard-row-selected");
        }
    }
}

function setPulseOk() {
    document.getElementById("pulse-id").className = "header-pulse-ok";
}

function setPulseError() {
    document.getElementById("pulse-id").className = "header-pulse-error";
}

let displayNames;
function getCountryName(isoCode) {
    if (!displayNames && typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    }

    if (displayNames) {
        try {
            const countryName = displayNames.of(isoCode);
            return countryName ? countryName : "";
        } catch (error) {
            return isoCode;
        }
    } else {
        return isoCode;
    }
}

function getFlag(country) {
    return country ? `<span style="padding-right: 10px" title="` + getCountryName(country) + `" class="fi fi-${country.toLowerCase()}"></span> ` : "<span></span>";
}

function getFlagStyled(country, style) {
    return country ? `<span style="` + style + `" title="` + getCountryName(country) + `" class="fi fi-${country.toLowerCase()}"></span> ` : "<span></span>";
}

// fetches main statistics from the server
async function fetchStatistics() {
    try {
        response = await fetch("stat.json");
    } catch (error) {
        setPulseError();
        return;
    }
    statistics = await response.json();
    setPulseOk();
    return statistics;
}

function updateStat(stat, tf) {
    [0, 1, 2, 3].forEach((e) => (document.getElementById("stat_" + tf + "_channel" + e).innerHTML = stat[tf].channel[e]));

    document.getElementById("stat_" + tf + "_count").innerHTML = stat[tf].count;
    document.getElementById("stat_" + tf + "_dist").innerHTML = getDistanceVal(stat[tf].dist) + " " + getDistanceUnit();
    document.getElementById("stat_" + tf + "_vessel_count").innerHTML = stat[tf].vessels;
    document.getElementById("stat_" + tf + "_msg123").innerHTML = stat[tf].msg[0] + stat[tf].msg[1] + stat[tf].msg[2];
    document.getElementById("stat_" + tf + "_msg5").innerHTML = stat[tf].msg[4];
    document.getElementById("stat_" + tf + "_msg18").innerHTML = stat[tf].msg[17];
    document.getElementById("stat_" + tf + "_msg19").innerHTML = stat[tf].msg[18];
    document.getElementById("stat_" + tf + "_msg68").innerHTML = stat[tf].msg[5] + stat[tf].msg[7];
    document.getElementById("stat_" + tf + "_msg1214").innerHTML = stat[tf].msg[11] + stat[tf].msg[13];
    document.getElementById("stat_" + tf + "_msg24").innerHTML = stat[tf].msg[23];
    document.getElementById("stat_" + tf + "_msg4").innerHTML = stat[tf].msg[3];
    document.getElementById("stat_" + tf + "_msg9").innerHTML = stat[tf].msg[8];
    document.getElementById("stat_" + tf + "_msg21").innerHTML = stat[tf].msg[20];
    document.getElementById("stat_" + tf + "_msg27").innerHTML = stat[tf].msg[26];

    var count_other = 0;
    [7, 10, 11, 13, 15, 16, 17, 20, 22, 23, 25, 26].forEach((i) => (count_other += stat[tf].msg[i - 1]));
    document.getElementById("stat_" + tf + "_msgother").innerHTML = count_other;
}

async function updateStatistics() {
    var stat = await fetchStatistics();

    if (stat) {
        // in bulk....
        ["os", "tcp_clients", "hardware", "build_describe", "build_date", "station", "product", "vendor", "serial", "model", "sample_rate", "received"].forEach(
            (e) => (document.getElementById("stat_" + e).innerHTML = stat[e]),
        );

        if (stat.station_link != "") document.getElementById("stat_station").innerHTML = "<a href='" + stat.station_link + "'>" + stat.station + "</a>";

        var statSharingElement = document.getElementById("stat_sharing");

        statSharingElement.innerHTML = `<a href="${stat.sharing_link}" target="_blank">${stat.sharing ? 'Yes' : 'No'}</a>`;
        statSharingElement.style.color = stat.sharing ? "green" : "red";


        document.getElementById("stat_update_time").textContent = Number(refreshIntervalMs / 1000).toFixed(1) + " s";
        var title = document.getElementById("stat_station").textContent;
        if (title != "" && title != null) {
            tab_title_station = title;
            updateTitle();
        }
        document.getElementById("stat_memory").innerHTML = stat.memory ? Number(stat.memory / 1000000).toFixed(1) + " MB" : "N/A";
        document.getElementById("stat_msg_rate").innerHTML = Number(stat.msg_rate).toFixed(1) + " msg/s";
        document.getElementById("stat_msg_min_rate").innerHTML = Number(stat.last_minute.count).toFixed(0) + " msg/min";
        document.getElementById("stat_run_time").innerHTML = getDeltaTimeVal(stat.run_time);

        updateStat(stat, "total");
        updateStat(stat, "session");
        updateStat(stat, "last_minute");
        updateStat(stat, "last_hour");
        updateStat(stat, "last_day");

        document.getElementById("stat_total_vessel_count").innerHTML = "-";
        document.getElementById("stat_session_vessel_count").innerHTML = stat.vessel_count;
    }
}

function updateChartMulti(b, f, c) {
    if (b.hasOwnProperty(f)) {
        var hA = [];
        var hB = [];
        var hT = [];
        var hS = [];
        var hV = [];


        const source = b[f];
        for (let i = 0; i < source.time.length; i++) {
            let cA = source.stat[i].msg[0] + source.stat[i].msg[1] + source.stat[i].msg[2] + source.stat[i].msg[4];
            hA.push({ x: source.time[i], y: cA });
            let cB = source.stat[i].msg[17] + source.stat[i].msg[18] + source.stat[i].msg[23];
            hB.push({ x: source.time[i], y: cB });
            let cS = source.stat[i].msg[3];
            hS.push({ x: source.time[i], y: cS });
            let cT = source.stat[i].count - cA - cB - cS;
            hT.push({ x: source.time[i], y: cT });
            let cV = source.stat[i].vessels;
            hV.push({ x: source.time[i], y: cV });
        }

        c.data.datasets[0].data = hV;
        c.data.datasets[1].data = hA;
        c.data.datasets[2].data = hB;
        c.data.datasets[3].data = hS;
        c.data.datasets[4].data = hT;

        c.update();
    }
}

function updateChartDistance(b, f, c) {
    if (b.hasOwnProperty(f)) {
        var hNE = [];
        var hSE = [];
        var hSW = [];
        var hNW = [];
        var hM = [];

        let source = b[f];

        if (source.stat[0].radar_a.length == 0) return;
        let N = source.stat[0].radar_a.length;
        let N4 = N / 4;
        for (let i = 0; i < source.time.length; i++) {
            let count = [0, 0, 0, 0];
            for (let j = 0; j < N; j++) count[Math.floor(j / N4)] = Math.max(count[Math.floor(j / N4)], source.stat[i].radar_a[j]);

            hNE.push({ x: source.time[i], y: getDistanceConversion(count[0]) }); // source.stat[i].radar[0]
            hSE.push({ x: source.time[i], y: getDistanceConversion(count[1]) });
            hSW.push({ x: source.time[i], y: getDistanceConversion(count[2]) });
            hNW.push({ x: source.time[i], y: getDistanceConversion(count[3]) });
            hM.push({ x: source.time[i], y: getDistanceConversion(source.stat[i].dist) });
        }
        c.data.datasets[0].data = hNE;
        c.data.datasets[1].data = hSE;
        c.data.datasets[2].data = hSW;
        c.data.datasets[3].data = hNW;
        c.data.datasets[4].data = hM;

        c.update();
    }
}

function updateChartSingle(b, f1, f2, c) {
    if (b.hasOwnProperty(f1)) {
        var h = [];

        const source = b[f1];
        for (let i = 0; i < source.time.length; i++) {
            h.push({ x: source.time[i], y: source.stat[i][f2] });
        }
        c.data.datasets[0].data = h;
        c.update();
    }
}

function updateChartLevel(b, f1, f2, c) {
    if (b.hasOwnProperty(f1)) {
        const source = b[f1];

        var h = [];

        for (let i = 0; i < source.time.length; i++) {
            h.push({ x: source.time[i], y: source.stat[i].level_min == 0 ? null : source.stat[i].level_min });
        }
        c.data.datasets[1].data = h;

        var h = [];
        for (let i = 0; i < source.time.length; i++) {
            h.push({ x: source.time[i], y: source.stat[i].level_max == 0 ? null : source.stat[i].level_max });
        }
        c.data.datasets[0].data = h;

        c.update();
    }
}

function updateRadar(b, f, c) {
    if (b.hasOwnProperty(f)) {
        var data_a = [],
            data_b = [];
        let idx = 0;
        if (b[f].stat.length > 1) idx = 1;
        let N = b[f].stat[idx].radar_a.length;
        for (var i = 0; i < N; i++) {
            data_a.push({
                r: getDistanceConversion(b[f].stat[idx].radar_a[i]),
                theta: (i * 360) / N,
            });
            data_b.push({
                r: getDistanceConversion(b[f].stat[idx].radar_b[i]),
                theta: (i * 360) / N,
            });
        }
        c.data.datasets[0].data = data_b;
        c.data.datasets[1].data = data_a;
        c.update();
    }
}

async function updatePlots() {
    const unit = getDistanceUnit().toUpperCase();
    document.querySelectorAll(".distunit").forEach((u) => {
        u.textContent = unit;
    });

    if (true) {
        try {
            response = await fetch("history_full.json");
        } catch (error) {
            setPulseError();
        }
        b = await response.json();
    } else {
        b = JSON.parse(chart_json);
    }
    setPulseOk();

    updateChartMulti(b, "second", chart_seconds);
    updateChartMulti(b, "minute", chart_minutes);
    updateChartMulti(b, "hour", chart_hours);
    updateChartMulti(b, "day", chart_days);

    updateChartSingle(b, "minute", "ppm", chart_ppm_minute);
    updateChartSingle(b, "hour", "ppm", chart_ppm);
    updateChartLevel(b, "minute", "level", chart_level);
    updateChartSingle(b, "minute", "vessels", chart_minute_vessel);

    //plot_radar.options.ticks.scale.max = 200;
    updateChartDistance(b, "hour", chart_distance_hour);
    updateChartDistance(b, "day", chart_distance_day);

    updateRadar(b, "hour", chart_radar_hour);
    updateRadar(b, "day", chart_radar_day);
}

function tableRowClick(m) {
    ship = shipsDB[m].raw;
    if (ship.lat == null || ship.lon == null) return;

    selectMapTab(m);
}

var table = null;

function downloadCSV() {
    if (table) table.download("csv", "data.csv");
}

document.getElementById("shipSearch").addEventListener("input", function (e) {
    const query = e.target.value;
    searchShips(query);
});

function searchShips(query) {
    if (table) {
        table.setFilter(customShipFilter, { query: query });
    }
}

function customShipFilter(data, filterParams) {
    const query = filterParams.query.toLowerCase();
    return data.shipname.toLowerCase().includes(query) ||
        data.mmsi.toString().includes(query) ||
        data.callsign.toLowerCase().includes(query) ||
        data.shipclass.toString().includes(query) ||
        (data.last_signal != null && getDeltaTimeVal(data.last_signal).includes(query)) ||
        (data.count != null && data.count.toString().includes(query)) ||
        (data.ppm != null && data.ppm.toString().includes(query)) ||
        (data.level != null && data.level.toString().includes(query)) ||
        (data.distance != null && getDistanceVal(data.distance).includes(query)) ||
        (data.bearing != null && data.bearing.toString().includes(query)) ||
        (data.lat != null && getLatValFormat(data).includes(query)) ||
        (data.lon != null && getLonValFormat(data).includes(query)) ||
        (data.speed != null && getSpeedVal(data.speed).toString().includes(query)) ||
        (data.validated != null && (data.validated == 1 ? "yes" : data.validated == -1 ? "no" : "pending").includes(query)) ||
        (data.channels != null && getStringfromChannels(data.channels).includes(query)) ||
        (data.group_mask != null && getStringfromGroup(data.group_mask).includes(query));
}

async function updateShipTable() {
    const ok = await fetchShips();
    if (!ok) return;

    const data = Object.values(shipsDB).map((ship) => ship.raw);

    if (table == null) {
        table = new Tabulator("#shipTable", {
            index: "mmsi",
            rowFormatter: function (row) {
                const ship = row.getData();
                const borderColor = ship.validated == 1 ? "#7CFC00" : ship.validated == -1 ? "red" : "lightgrey";
                row.getElement().style.borderLeft = `10px solid ${borderColor}`;
            },
            data: data,
            persistence: true,
            pagination: "local",
            paginationSize: 50,
            rowHeight: 37,
            paginationSizeSelector: [20, 50, 100],
            columns: [
                {
                    title: "Shipname",
                    field: "shipname",
                    sorter: "string",
                    formatter: function (cell) {
                        const ship = cell.getRow().getData();
                        return getFlag(ship.country) + getShipName(ship);
                    },
                },
                { title: "MMSI", field: "mmsi", sorter: "number" },
                {
                    title: "Callsign",
                    field: "callsign",
                    sorter: "string",
                    formatter: function (cell) {
                        const ship = cell.getRow().getData();
                        return ship != null ? getCallSign(ship) : "";
                    },
                },
                {
                    title: "Type",
                    field: "shipclass",
                    sorter: "number",
                    formatter: function (cell) {
                        const ship = cell.getRow().getData();
                        return ship != null ? "<span " + getIconCSS(ship) + "></span>" : "";
                    },
                },
                {
                    title: "Last",
                    field: "last_signal",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value != null ? getDeltaTimeVal(value) : "";
                    },
                },
                { title: "Msgs", field: "count", sorter: "number" },
                {
                    title: "PPM",
                    field: "ppm",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value != null ? Number(value).toFixed(1) : "";
                    },
                },
                {
                    title: "RSSI",
                    field: "level",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value != null ? Number(value).toFixed(1) : "";
                    },
                },
                {
                    title: "Dist",
                    field: "distance",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value != null ? getDistanceVal(value) : "";
                    },
                },
                {
                    title: "Brg",
                    field: "bearing",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value != null ? Number(value).toFixed(0) + "&deg;" : "";
                    },
                },
                {
                    title: "Lat",
                    field: "lat",
                    sorter: "number",
                    formatter: function (cell) {
                        const ship = cell.getRow().getData();
                        const color = ship.validated == 1 ? "green" : ship.validated == -1 ? "red" : "inherited";
                        return "<div style='color:" + color + "'>" + (ship.lat != null ? getLatValFormat(ship) : "") + "</div>";
                    },
                },
                {
                    title: "Lon",
                    field: "lon",
                    sorter: "number",
                    formatter: function (cell) {
                        const ship = cell.getRow().getData();
                        const color = ship.validated == 1 ? "green" : ship.validated == -1 ? "red" : "inherited";
                        return "<div style='color:" + color + "'>" + (ship.lon != null ? getLonValFormat(ship) : "") + "</div>";
                    },
                },
                {
                    title: "Spd",
                    field: "speed",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return value ? getSpeedVal(value) + " " + getSpeedUnit() : null;
                    },
                },
                {
                    title: "Valid",
                    field: "validated",
                    sorter: "string",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        const txt = value == 1 ? "Yes" : value == -1 ? "No" : "Pending";
                        return txt;
                    },
                },
                {
                    title: "Ch",
                    field: "channels",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return getStringfromChannels(value);
                    },
                },
                {
                    title: "Src",
                    field: "group_mask",
                    sorter: "number",
                    formatter: function (cell) {
                        const value = cell.getValue();
                        return getStringfromGroup(value);
                    },
                },
            ],
        });
        table.on("rowContext", function (e, row) {
            showContextMenu(event, row.getData().mmsi, ["settings", "mmsi", "table-menu"]);
        });
        table.on("rowClick", function (e, row) {
            tableRowClick(row.getData().mmsi);
        });
    } else {
        if (data.length == 0) {
            table.clearData();
            return;
        }
        table.updateOrAddData(data);
        table.getRows().forEach((row) => {
            const mmsi = row.getData().mmsi;
            if (!(mmsi in shipsDB)) row.delete();
        });
        var sorters = table.getSorters();
        table.setSort(sorters);
    }
}

function getTooltipContent(ship) {
    return '<div>' + getFlagStyled(ship.country, "padding: 0px; margin: 0px; margin-right: 10px; margin-left: 3px; box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2); font-size: 26px;") + `</div><div><div><b>${getShipName(ship) || ship.mmsi}</b> at <b>${getSpeedVal(ship.speed)} ${getSpeedUnit()}</b></div><div>Received <b>${getDeltaTimeVal(ship.last_signal)}</b> ago</div></div>`;
}

function getTypeVal(ship) {
    switch (ship.mmsi_type) {
        case CLASS_A:
            return "Ship (Class A)";
        case CLASS_B:
            return "Ship (Class B)";
        case BASESTATION:
            return "Base Station";
        case SAR:
            return "SAR aircraft";
        case SARTEPIRB:
            return "AIS SART/EPIRB";
        case ATON:
            return "Aid-to-Navigation";
    }
    return "Unknown";
}

function getShipOpacity(ship) {
    if (settings.fading == false) return 1;

    let opacity = 1 - (ship.last_signal / 1800) * 0.8;
    return Math.max(0.2, Math.min(1, opacity));
}


function getShipCSSClassAndStyle(ship, opacity = 1) {
    getSprite(ship);
    let style = `opacity: ${opacity};`;
    let scale = settings.icon_scale;

    style += `background-position: -${ship.cx - 0}px -${ship.cy - 0}px; width: 20px; height: 20px; transform: rotate(${ship.rot}rad) scale(${scale});`;

    return { class: "sprites", style: style, hint: ship.hint };
}

function getIconCSS(ship, opacity = 1) {
    const { class: classValue, style, hint } = getShipCSSClassAndStyle(ship, opacity);
    return `class="${classValue}" style="${style}" title="${hint}"`;
}

function getIcon(ship) {
    const { class: classValue, style } = getShipCSSClassAndStyle(ship);
    return L.divIcon({ html: `<div class="${classValue}" style="${style}"></div>`, className: "undefined" });
}

function notImplemented() {
    showDialog("Warning", "Not implemented yet");
}


const stopHover = function () {
    hover_info.style.visibility = 'hidden';

    if (hoverMMSI in shapeFeatures) {
        shapeFeatures[hoverMMSI].changed();
    }

    hoverMMSI = undefined;
    updateHoverMarker();
    trackLayer.changed();
}

function updateFocusMarker() {
    if (selectCircleFeature) {
        if (card_mmsi in shipsDB && shipsDB[card_mmsi].raw.lon && shipsDB[card_mmsi].raw.lat) {
            const center = ol.proj.fromLonLat([shipsDB[card_mmsi].raw.lon, shipsDB[card_mmsi].raw.lat]);
            selectCircleFeature.setGeometry(new ol.geom.Point(center));
            return;
        }
        else {
            extraVector.removeFeature(selectCircleFeature);
            selectCircleFeature = undefined;
            return;
        }
    }

    if (card_mmsi in shipsDB && shipsDB[card_mmsi].raw.lon && shipsDB[card_mmsi].raw.lat) {

        const center = ol.proj.fromLonLat([shipsDB[card_mmsi].raw.lon, shipsDB[card_mmsi].raw.lat]);
        selectCircleFeature = new ol.Feature(new ol.geom.Point(center));
        selectCircleFeature.setStyle(selectCircleStyleFunction);
        selectCircleFeature.mmsi = card_mmsi;
        extraVector.addFeature(selectCircleFeature);
    }
}

const showTooltipShip = function (id, mmsi, pixel) {
    if (mmsi in shipsDB)
        id.innerHTML = getTooltipContent(shipsDB[mmsi].raw);
    else
        id.innerHTML = mmsi;

    if (pixel) {
        id.style.left = pixel[0] + 'px';
        id.style.top = pixel[1] + 'px';

        if ((pixel[0] >= 0 || pixel[0] <= map.getSize()[0] || pixel[1] >= 0 || pixel[1] <= map.getSize()[1])) {
            id.style.visibility = 'visible';
        }
    }
}

const startHover = function (mmsi, pixel = undefined) {

    if (mmsi !== hoverMMSI) {
        if (hoverMMSI || hoverCircleFeature) {
            stopHover();
        }

        if ((mmsi in shipsDB && shipsDB[mmsi].raw.lon && shipsDB[mmsi].raw.lat)) {
            const center = ol.proj.fromLonLat([shipsDB[mmsi].raw.lon, shipsDB[mmsi].raw.lat]);
            pixel = map.getPixelFromCoordinate(center);
            hoverMMSI = mmsi;
            showTooltipShip(hover_info, hoverMMSI, pixel);
        }
        else {
            hoverMMSI = mmsi;
            showTooltipShip(hover_info, hoverMMSI, pixel);
        }
        updateHoverMarker();
        trackLayer.changed();
        if (mmsi in shapeFeatures) {
            shapeFeatures[mmsi].changed();
        }
    }
}


function updateHoverMarker() {

    if (hoverCircleFeature) {
        if (hoverMMSI in shipsDB && shipsDB[hoverMMSI].raw.lon && shipsDB[hoverMMSI].raw.lat) {
            const center = ol.proj.fromLonLat([shipsDB[hoverMMSI].raw.lon, shipsDB[hoverMMSI].raw.lat]);
            hoverCircleFeature.setGeometry(new ol.geom.Point(center));
            return;
        }
        else {
            extraVector.removeFeature(hoverCircleFeature);
            hoverCircleFeature = undefined;
            hoverMMSI = undefined;
            return;
        }
    }

    if (hoverMMSI in shipsDB && shipsDB[hoverMMSI].raw.lon && shipsDB[hoverMMSI].raw.lat) {

        const center = ol.proj.fromLonLat([shipsDB[hoverMMSI].raw.lon, shipsDB[hoverMMSI].raw.lat]);
        hoverCircleFeature = new ol.Feature(new ol.geom.Point(center));
        hoverCircleFeature.setStyle(hoverCircleStyleFunction);
        hoverCircleFeature.mmsi = hoverMMSI;
        extraVector.addFeature(hoverCircleFeature);
    }
}



function getFeature(pixel, target) {
    const feature = target.closest('.ol-control') ? undefined : map.forEachFeatureAtPixel(pixel,
        function (feature) { if ('ship' in feature || 'tooltip' in feature) { return feature; } }, { hitTolerance: 10 });

    if (feature) return feature;
    return undefined;
}

const handlePointerMove = function (pixel, target) {
    const feature = getFeature(pixel, target)

    if (feature && 'ship' in feature) {
        startHover(feature.ship.mmsi, pixel);
    }
    else if (feature && 'tooltip' in feature) {
        startHover(feature.tooltip, pixel);
    } else if (hoverMMSI) {
        stopHover();
    }

    if (isMeasuring) {

        const lastMeasureIndex = measures.length - 1;

        if (feature && 'ship' in feature) {
            measures[lastMeasureIndex] = {
                ...measures[lastMeasureIndex],
                end_value: feature.ship.mmsi,
                end_type: "ship"
            };
        }
        else {
            measures[lastMeasureIndex] = {
                ...measures[lastMeasureIndex],
                end_value: ol.proj.toLonLat(map.getCoordinateFromPixel(pixel)),
                end_type: "point"
            };
        }

        refreshMeasures();
    }
};


function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedSaveSettings = debounce(saveSettings, 250);
const debouncedDrawMap = debounce(redrawMap, 250);

function updateMapURL() {
    if (isAndroid()) return;

    let view = map.getView();
    let center = ol.proj.toLonLat(view.getCenter()); // Converts the center coordinates to [lon, lat]
    let newURL = window.location.href.split("?")[0] + "?lat=" + center[1].toFixed(4) + "&lon=" + center[0].toFixed(4) + "&zoom=" + view.getZoom().toFixed(2) + "&tab=" + settings.tab;
    history.replaceState(null, null, newURL);
}


function saveSettings() {
    if (map !== undefined) {
        var view = map.getView();
        var center = ol.proj.toLonLat(view.getCenter()); // Convert the center coordinate to longitude and latitude
        settings.lat = center[1]; // Latitude
        settings.lon = center[0]; // Longitude
        settings.zoom = view.getZoom(); // Zoom level
    }


    const scRows = document.querySelectorAll(".shipcard-content-row");

    const selectedRows = [];
    scRows.forEach((row) => {
        const rowClasses = row.getAttribute("class");
        selectedRows.push(rowClasses.includes("shipcard-max-only") ? 0 : 1);
    });

    settings.shipcard_max = isShipcardMax();
    settings.shipcard_rows = selectedRows;

    localStorage[context] = JSON.stringify(settings);

    updateMapURL();
    updateSettingsTab();
}

function loadSettings() {
    if (!urlParams.has("reset")) {
        try {
            const localStorageSettings = localStorage.getItem(context);
            if (localStorageSettings !== null) {
                const ls = JSON.parse(localStorageSettings);
                settings = { ...settings, ...ls };
            }
        } catch (error) {
            console.log(error);
            return;
        }
    }
    if (!shipcardismax()) toggleShipcardSize();

    if (settings.shipcard_rows && settings.shipcard_rows.length > 0) {
        const rows = document.querySelectorAll(".shipcard-content-row");

        rows.forEach((row, index) => {
            if (settings.shipcard_rows[index] == 1) {
                row.setAttribute("class", "mapcard-content-row shipcard-content-row shipcard-row-selected");
            } else {
                row.setAttribute("class", "mapcard-content-row shipcard-content-row shipcard-max-only");
            }
        });
        if (settings.shipcard_max != shipcardismax()) {
            toggleShipcardSize();
        }
    }
}

function loadSettingsFromURL() {
    for (const [key, value] of urlParams.entries()) if (settings.hasOwnProperty(key)) settings = { ...settings, [key]: value };

    settings.dark_mode = settings.dark_mode == "true" || settings.dark_mode == true;
    settings.show_range = settings.show_range == "true" || settings.show_range == true;
    settings.show_station = settings.show_station == "true" || settings.show_station == true;
    settings.latlon_in_dms = settings.latlon_in_dms == "true" || settings.latlon_in_dms == true;
}

function mapResetViewZoom(z, m) {
    if (m && m in shipsDB) {
        let ship = shipsDB[m].raw;
        let view = map.getView();
        view.setCenter(ol.proj.fromLonLat([ship.lon, ship.lat]));
        view.setZoom(Math.min(view.getMaxZoom(), Math.max(z, view.getZoom() + 1)));
    }

    shipcardMinIfMaxonMobile();
}

function mapResetView(z) {

    let view = map.getView();
    view.setZoom(Math.min(view.getMaxZoom(), Math.max(z, view.getZoom() + 1)));
    shipcardMinIfMaxonMobile();
}

function shipcardVisible() {
    return document.getElementById("shipcard").classList.contains("visible");
}

function measurecardVisible() {
    return document.getElementById("measurecard").classList.contains("visible");
}

function toggleMeasurecard() {
    if (shipcardVisible() && !measurecardVisible()) showShipcard(null);
    document.getElementById("measurecard").classList.toggle("visible");
}

async function toggleTrack(m) {

    if (marker_tracks.has(Number(m))) {
        marker_tracks.delete(Number(m));
        redrawMap();
    } else {
        marker_tracks.add(Number(m));
        await fetchTracks();
        shipcardMinIfMaxonMobile();
        redrawMap();
    }

    if (card_mmsi == m) {
        document.getElementById("shipcard_track").innerText = marker_tracks.has(Number(card_mmsi)) ? "Hide Track" : "Show Track";
    }
}

function pinStation() {
    pinVessel("STATION");
}

function pinVessel(m) {
    settings.center_point = m;
    settings.fix_center = true;
    saveSettings();
    drawStation();
}

function unpinCenter() {
    settings.fix_center = false;
    saveSettings();
    drawStation();
}


async function showAllTracks() {
    show_all_tracks = true;
    await fetchTracks();
    redrawMap();
    updateShipcardTrackOption()
}

function deleteAllTracks() {
    paths = {};
    marker_tracks = new Set();
    show_all_tracks = false;
    redrawMap();
    updateShipcardTrackOption();
}

async function fetchTracks() {
    if (marker_tracks.size == 0 && show_all_tracks == false) return true;

    try {
        if (show_all_tracks) a = await fetch("allpath.json");
        else {

            for (var mmsi of marker_tracks) {
                if (!(mmsi in shipsDB)) {
                    toggleTrack(mmsi);
                }
            }

            var mmsi_str = Array.from(marker_tracks).join(",");
            a = await fetch("path.json?" + mmsi_str);
        }
        paths = await a.json();
    } catch (error) {
        console.log("Error loading path: " + error);
        paths = {};
        return false;
    }

    for (var mmsi in paths) {
        if (paths.hasOwnProperty(mmsi)) {
            if (mmsi in shipsDB && paths[mmsi].length > 0) {
                shipsDB[mmsi].raw.lat = paths[mmsi][0][0];
                shipsDB[mmsi].raw.lon = paths[mmsi][0][1];
            }
        }
    }
    return true;
}

function updateShipcardTrackOption() {
    if (show_all_tracks) {
        document.getElementById("shipcard_track_option").style.display = "none";
    } else {
        document.getElementById("shipcard_track_option").style.display = "flex";
    }
}

function isShipcardMax() {
    var e = document.getElementById("shipcard").classList;
    return e.contains("shipcard-ismax");
}

function getStringfromMsgType(m) {
    let s = "";
    let delim = "";
    for (i = 1; i <= 27; i++)
        if ((m & (1 << i)) != 0) {
            s += delim + Number(i).toFixed(0);
            delim = ", ";
        }
    return s;
}

function getStringfromGroup(m) {
    let s = "";
    let delim = "";
    let count = 0;

    for (i = 0; i < 32; i++) {
        let mask = 1 << i;
        if ((m & mask) !== 0) {
            if (count == 4) {
                s += delim + "...";
                break;
            }
            s += delim + Number(i + 1).toFixed(0);
            delim = ", ";
            count++;
        }
    }
    return s;
}

function getStringfromChannels(m) {
    let s = "";
    let delim = "";
    for (i = 0; i <= 3; i++)
        if ((m & (1 << i)) != 0) {
            s += delim + String.fromCharCode(65 + i);
            delim = ", ";
        }
    return s;
}

function setShipcardValidation(v) {
    document.getElementById("shipcard_header").classList.remove("shipcard-validated", "shipcard-not-validated", "shipcard-dubious");

    switch (v) {
        case 1:
            document.getElementById("shipcard_header").classList.add("shipcard-validated");
            break;
        case -1:
            document.getElementById("shipcard_header").classList.add("shipcard-dubious");
            break;
        default:
            document.getElementById("shipcard_header").classList.add("shipcard-not-validated");
    }
}

function populateShipcard() {
    if (!(card_mmsi in shipsDB)) {
        document
            .getElementById("shipcard_content")
            .querySelectorAll("span:nth-child(2)")
            .forEach((e) => (e.innerHTML = null));
        document.getElementById("shipcard_header_title").innerHTML = "<b style='color:red;'>Out of range</b>";
        document.getElementById("shipcard_header_flag").innerHTML = "";
        document.getElementById("shipcard_mmsi").innerHTML = card_mmsi;

        updateFocusMarker();
        return;
    }

    let ship = shipsDB[card_mmsi].raw;

    document.getElementById("shipcard_header_flag").innerHTML = getFlagStyled(ship.country, "padding: 0px; margin: 0px; margin-right: 5px; box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.5); font-size: 26px;");
    document.getElementById("shipcard_header_title").innerHTML = (getShipName(ship) || ship.mmsi);

    setShipcardValidation(ship.validated);

    // verbatim copies
    ["destination", "mmsi", "count", "imo"].forEach((e) => (document.getElementById("shipcard_" + e).innerHTML = ship[e]));

    // round and add units
    [
        { id: "cog", u: "&deg", d: 0 },
        { id: "bearing", u: "&deg", d: 0 },
        { id: "heading", u: "&deg", d: 0 },
        { id: "level", u: "dB", d: 1 },
        { id: "ppm", u: "ppm", d: 1 },
    ].forEach((el) => (document.getElementById("shipcard_" + el.id).innerHTML = ship[el.id] ? Number(ship[el.id]).toFixed(el.d) + " " + el.u : null));

    document.getElementById("shipcard_country").innerHTML = getCountryName(ship.country);
    document.getElementById("shipcard_callsign").innerHTML = getCallSign(ship);
    document.getElementById("shipcard_msgtypes").innerHTML = getStringfromMsgType(ship.msg_type);

    document.getElementById("shipcard_last_group").innerHTML = getStringfromGroup(ship.last_group);
    document.getElementById("shipcard_sources").innerHTML = getStringfromGroup(ship.group_mask);

    document.getElementById("shipcard_channels").innerHTML = getStringfromChannels(ship.channels);
    document.getElementById("shipcard_type").innerHTML = getTypeVal(ship);
    document.getElementById("shipcard_shiptype").innerHTML = getShipTypeVal(ship.shiptype);
    document.getElementById("shipcard_status").innerHTML = getStatusVal(ship);
    document.getElementById("shipcard_last_signal").innerHTML = getDeltaTimeVal(ship.last_signal);
    document.getElementById("shipcard_eta").innerHTML = ship.eta_month != null && ship.eta_hour != null && ship.eta_day != null && ship.eta_minute != null ? getEtaVal(ship) : null;
    document.getElementById("shipcard_lat").innerHTML = ship.lat ? getLatValFormat(ship) : null;
    document.getElementById("shipcard_lon").innerHTML = ship.lon ? getLonValFormat(ship) : null;

    document.getElementById("shipcard_speed").innerHTML = ship.speed ? getSpeedVal(ship.speed) + " " + getSpeedUnit() : null;
    document.getElementById("shipcard_distance").innerHTML = ship.distance ? getDistanceVal(ship.distance) + " " + getDistanceUnit() : null;
    document.getElementById("shipcard_draught").innerHTML = ship.draught ? getDimVal(ship.draught) + " " + getDimUnit() : null;
    document.getElementById("shipcard_dimension").innerHTML =
        ship.to_bow != null && ship.to_stern != null && ship.to_port != null && ship.to_starboard != null
            ? getDimVal(ship.to_bow + ship.to_stern) + " " + getDimUnit() + " x " + getDimVal(ship.to_port + ship.to_starboard) + " " + getDimUnit()
            : null;

    document.getElementById("shipcard_track").innerText = marker_tracks.has(Number(card_mmsi)) ? "Hide Track" : "Show Track";
}

function shipcardMinIfMaxonMobile() {
    if (shipcardVisible() && window.matchMedia("(max-height: 1000px) and (max-width: 500px)").matches && isShipcardMax()) {
        toggleShipcardSize();
    }
}

function drawStation() {
    const hasNoStation = settings.show_station == false || station == null || !station.hasOwnProperty("lat") || !station.hasOwnProperty("lon");
    const hasMMSIcenter = settings.center_point && settings.center_point != "STATION" && settings.center_point in shipsDB;

    if (stationFeature) {
        extraVector.removeFeature(stationFeature);
        stationFeature = undefined;
    }

    if (hasNoStation) {
        return;
    }

    const radius = 10;
    let svgIconStyle = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 0.5],
            scale: 0.3,
            color: 'white', //getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 -960 960 960" width="48"%3E%3Cpath fill="white" d="M198-278q-60-58-89-133T80-560q0-74 29-149t89-133l35 35q-50 49-76.5 116.5T130-560q0 63 26.5 130.5T233-313l-35 35Zm92-92q-40-37-59-89.5T212-560q0-48 19-100.5t59-89.5l35 35q-29 29-46 72.5T262-560q0 35 17.5 79.5T325-405l-35 35Zm4 290 133-405q-17-12-27.5-31T389-560q0-38 26.5-64.5T480-651q38 0 64.5 26.5T571-560q0 25-10.5 44T533-485L666-80h-59l-29-90H383l-30 90h-59Zm108-150h156l-78-238-78 238Zm268-140-35-35q29-29 46-72.5t17-82.5q0-35-17.5-79.5T635-715l35-35q39 37 58.5 89.5T748-560q0 47-19.5 100T670-370Zm92 92-35-35q49-49 76-116.5T830-560q0-63-27-130.5T727-807l35-35q60 58 89 133t29 149q0 75-27.5 149.5T762-278Z"/%3E%3C/svg%3E',
        })
    });

    let CircleStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            stroke: new ol.style.Stroke({
                color: 'white',
                width: 3
            }),
            fill: new ol.style.Fill({
                color: getComputedStyle(document.documentElement).getPropertyValue('--tertiary-color')
            }),
        })
    });

    stationFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([station.lon, station.lat]))
    });

    stationFeature.setStyle([CircleStyle, svgIconStyle]);
    stationFeature.tooltip = "Receiving Station";
    stationFeature.station = true;
    extraVector.addFeature(stationFeature);

    // MMSI is driving center but does not exist
    if (!hasMMSIcenter && settings.center_point != "STATION") {
        settings.center_point = "STATION";
        settings.fix_center = false;
    }

    if (settings.center_point == "STATION") {
        center = station;
    } else {
        center = {};
        if (hasMMSIcenter) {
            let ship = shipsDB[settings.center_point].raw;
            if (ship.lat != null && ship.lon != null) {
                center = { lat: ship.lat, lon: ship.lon };
            }
        }
    }

    if (settings.fix_center && center != null && center.hasOwnProperty("lat") && center.hasOwnProperty("lon")) {

        let view = map.getView();
        view.setCenter(ol.proj.fromLonLat([center.lon, center.lat]));

        settings.lat = center.lat;
        settings.lon = center.lon;
    }
}

function showShipcard(m) {
    const aside = document.getElementById("shipcard");
    const visible = shipcardVisible();

    ship = m in shipsDB ? shipsDB[m].raw : null;
    ship_old = card_mmsi in shipsDB ? shipsDB[card_mmsi].raw : null;

    if (m != null && !visible) {
        if (measurecardVisible()) toggleMeasurecard();
        aside.classList.toggle("visible");
    } else if (visible && m == null) {
        aside.classList.toggle("visible");
    }

    card_mmsi = m;

    updateFocusMarker();
    trackLayer.changed();

    if (shipcardVisible()) {
        populateShipcard();

        if (ship && ship.lon && ship.lat) {
            let shipCoords = ol.proj.fromLonLat([ship.lon, ship.lat]);

            let view = map.getView();
            let extent = view.calculateExtent(map.getSize());

            if (!ol.extent.containsCoordinate(extent, shipCoords)) {
                view.setCenter(shipCoords);
                //view.setZoom(view.getMaxZoom());
            }
        }
        if (!visible) shipcardMinIfMaxonMobile();
    }
}

function compareObjects(obj1, obj2) {
    const differences = {};

    // Helper function to compare values
    function compareValues(key, value1, value2) {
        if (value1 === null || value2 === null) {
            if (value1 !== value2) {
                differences[key] = { obj1: value1, obj2: value2 };
            }
        } else if (typeof value1 === "object" && typeof value2 === "object") {
            const objDiff = compareObjects(value1, value2);
            if (Object.keys(objDiff).length > 0) {
                differences[key] = objDiff;
            }
        } else if (value1 !== value2) {
            differences[key] = { obj1: value1, obj2: value2 };
        }
    }

    // Compare keys from obj1
    for (const key of Object.keys(obj1)) {
        if (key != "lat" && key != "lon" && key != "received")
            if (!obj2.hasOwnProperty(key)) {
                differences[key] = { obj1: obj1[key], obj2: undefined };
            } else {
                compareValues(key, obj1[key], obj2[key]);
            }
    }

    // Compare keys from obj2
    for (const key of Object.keys(obj2)) {
        if (key != "lat" && key != "lon" && key != "received")
            if (!obj1.hasOwnProperty(key)) {
                differences[key] = { obj1: undefined, obj2: obj2[key] };
            } else if (!differences.hasOwnProperty(key)) {
                compareValues(key, obj1[key], obj2[key]);
            }
    }

    return differences;
}

const shippingMappings = {
    [ShippingClass.OTHER]: { cx: 120, cy: 20, hint: 'Other', imgSize: 20 },
    [ShippingClass.UNKNOWN]: {
        cx: 120,
        cy: 20,
        hint: 'Unknown',
        imgSize: 20
    },
    [ShippingClass.CARGO]: { cx: 0, cy: 20, hint: 'Cargo', imgSize: 20 },
    [ShippingClass.TANKER]: { cx: 80, cy: 20, hint: 'Tanker', imgSize: 20 },
    [ShippingClass.PASSENGER]: {
        cx: 40,
        cy: 20,
        hint: 'Passenger',
        imgSize: 20
    },
    [ShippingClass.HIGHSPEED]: {
        cx: 100,
        cy: 20,
        hint: 'High Speed',
        imgSize: 20
    },
    [ShippingClass.SPECIAL]: {
        cx: 60,
        cy: 20,
        hint: 'Special',
        imgSize: 20
    },
    [ShippingClass.FISHING]: {
        cx: 140,
        cy: 20,
        hint: 'Fishing',
        imgSize: 20
    },
    [ShippingClass.ATON]: {
        cx: 0,
        cy: 40,
        hint: 'Aid-to-Navigation',
        imgSize: 20
    },
    [ShippingClass.PLANE]: { cx: 0, cy: 60, hint: 'Aircraft', imgSize: 25 },
    [ShippingClass.HELICOPTER]: {
        cx: 0,
        cy: 85,
        hint: 'Helicopter',
        imgSize: 25
    },
    [ShippingClass.B]: { cx: 20, cy: 20, hint: 'Class B', imgSize: 20 },
    [ShippingClass.STATION]: {
        cx: 20,
        cy: 40,
        hint: 'Base Station',
        imgSize: 20
    },
    [ShippingClass.SARTEPIRB]: {
        cx: 40,
        cy: 40,
        hint: 'AIS SART/EPIRB',
        imgSize: 20
    }
}

function getSprite(ship) {
    let shipClass = ship.shipclass;
    let sprite = shippingMappings[shipClass] || {
        cx: 120,
        cy: 20,
        imgSize: 20,
        hint: ''
    }

    ship.rot = 0
    ship.cx = sprite.cx
    ship.cy = sprite.cy
    ship.imgSize = sprite.imgSize
    ship.hint = sprite.hint

    if (sprite.cy === 20) {
        if (ship.speed != null && ship.speed > 0.5 && ship.cog != null) {
            ship.cy = 0
            ship.rot = ship.cog * 3.1415926 / 180;
        }
    } else if ((shipClass == ShippingClass.HELICOPTER || shipClass == ShippingClass.PLANE) && ship.cog != null) {
        ship.rot = ship.cog * 3.1415926 / 180;
    }

    return
}

var SpritesAll =
    'data:image/png;base64,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'


async function updateMap() {
    let ok = false;

    if (fetch_binary) ok = await fetchShipsBinary();
    else ok = await fetchShips();
    if (!ok) return;


    ok = await fetchTracks();
    if (!ok) return;

    if (settings.setcoord == "true" || settings.setcoord == true) {
        if (station != null && station.hasOwnProperty("lat") && station.hasOwnProperty("lon")) {
            settings.setcoord = false;
            let view = map.getView();
            view.setCenter(ol.proj.fromLonLat([station.lon, station.lat]));
            saveSettings();
        }
    }
    if (shipcardVisible()) populateShipcard();
    updateMarkerCount();
    await fetchRange();

    redrawMap();
}

function redrawMap() {
    shapeFeatures = {};
    markerFeatures = {};

    markerVector.clear();
    shapeVector.clear();
    labelVector.clear();
    trackVector.clear();

    labelLayer.declutter_ = settings.labels_declutter;

    const includeLabels = (settings.show_labels === "dynamic" && (map.getView().getZoom() > 11.5)) || settings.show_labels === "always";

    for (let [mmsi, entry] of Object.entries(shipsDB)) {
        let ship = entry.raw;
        if (ship.lat != null && ship.lon != null && ship.lat != 0 && ship.lon != 0 && ship.lat < 90 && ship.lon < 180) {
            getSprite(ship)

            const lon = ship.lon
            const lat = ship.lat

            const point = new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
            var feature = new ol.Feature({
                geometry: point
            })

            feature.ship = ship;

            markerFeatures[ship.mmsi] = feature
            markerVector.addFeature(feature)

            if (includeLabels)
                labelVector.addFeature(feature)

            if (map.getView().getZoom() > 11.5 && (ship.heading != null || settings.show_circle_outline)) {
                var shapeFeature = new ol.Feature({
                    geometry: createShipOutlineGeometry(ship)
                })
                shapeFeature.ship = ship
                shapeFeatures[ship.mmsi] = shapeFeature

                shapeVector.addFeature(shapeFeature)
            }
        }
        refreshMeasures();
    }

    for (let [mmsi, entry] of Object.entries(paths)) {

        if (marker_tracks.has(Number(mmsi)) || show_all_tracks) {
            const path = paths[mmsi];
            const coordinates = [];
            for (var i = 0; i < Math.min(path.length, 250); i++) {
                coordinates.push(ol.proj.fromLonLat([path[i][1], path[i][0]]));
            }

            const lineString = new ol.geom.LineString(coordinates);
            const feature = new ol.Feature(lineString);
            feature.mmsi = mmsi;
            trackVector.addFeature(feature);
        }
    }

    drawRange();
    updateFocusMarker();
    updateHoverMarker();

    updateMarkerCount();
    updateTablecard();

    drawStation(station);
    updateDistanceCircles();

    //await plotRange();

}
function updateDarkMode() {
    document.documentElement.classList.toggle("dark", settings.dark_mode);

    const chartsToUpdateMulti = [chart_minutes, chart_hours, chart_days, chart_seconds];
    const chartsToUpdateLevel = [chart_level];
    const chartsToUpdateSingle = [chart_distance_day, chart_distance_hour, chart_ppm, chart_minute_vessel, chart_ppm_minute];
    const chartsToUpdateRadar = [chart_radar_day, chart_radar_hour];

    chartsToUpdateMulti.forEach((chart) => {
        updateColorMulti(chart);
        chart.update();
    });

    chartsToUpdateSingle.forEach((chart) => {
        updateColorSingle(chart);
        chart.update();
    });

    chartsToUpdateLevel.forEach((chart) => {
        const colorVariables = ["--chart1-color", "--chart1-color", "--chart1-color"];
        updateChartColors(chart, colorVariables);
        chart.update();
    });

    chartsToUpdateRadar.forEach((chart) => {
        updateColorRadar(chart);
        chart.update();
    });

    updateMapLayer();
    redrawMap();
}


document.getElementById('zoom-in').addEventListener('click', function () {
    var view = map.getView();
    var zoom = view.getZoom();
    view.setZoom(zoom + 1);
});

document.getElementById('zoom-out').addEventListener('click', function () {
    var view = map.getView();
    var zoom = view.getZoom();
    view.setZoom(zoom - 1);
});

function setDarkMode(b) {
    settings.dark_mode = b;
    updateDarkMode();
    saveSettings();
}

function toggleDarkMode() {
    settings.dark_mode = !settings.dark_mode;
    updateDarkMode();
    saveSettings();
}

function refresh_data() {
    if (!document.hidden && !updateInProgress) {
        updateInProgress = true;

        (async () => {
            try {
                if (settings.tab === "map") {
                    await updateMap();
                } else if (settings.tab === "stat") {
                    await updateStatistics();
                } else if (settings.tab === "plots") {
                    await updatePlots();
                } else if (settings.tab === "ships") {
                    await updateShipTable();
                }
            } catch (error) {
                console.error("Error updating data:", error);
            } finally {
                updateInProgress = false;
            }
        })();
    }
}

async function openFocus(m, z) {
    await fetchShips(false);

    selectMapTab(m);

    let ship = shipsDB[m].raw;
    if (ship && ship.lon && ship.lat) {
        let shipCoords = ol.proj.fromLonLat([ship.lon, ship.lat]);
        let view = map.getView();
        view.setCenter(shipCoords);
    }

    if (z) mapResetView(z);
    else mapResetView(14);

    //showTrack(m);
}

function updateSettingsTab() {
    document.getElementById("settings_darkmode").checked = settings.dark_mode;
    document.getElementById("settings_latlon_in_dms").checked = settings.latlon_in_dms;
    document.getElementById("settings_metric").value = getMetrics().toLowerCase();
    document.getElementById("settings_show_station").checked = settings.show_station;
    document.getElementById("settings_fading").checked = settings.fading;
    document.getElementById("settings_shiphover_color").value = settings.shiphover_color;
    document.getElementById("settings_shipselection_color").value = settings.shipselection_color;

    document.getElementById("settings_show_range").checked = settings.show_range;
    document.getElementById("settings_distance_circles").checked = settings.distance_circles;
    document.getElementById("settings_distance_circle_color").value = settings.distance_circle_color;

    document.getElementById("settings_labels_declutter").checked = settings.labels_declutter;
    document.getElementById("settings_tooltipLabelFontsize").value = settings.tooltipLabelFontSize;

    document.getElementById("settings_show_labels").value = settings.show_labels.toLowerCase();

    document.getElementById("settings_shipoutline_border").value = settings.shipoutline_border;
    document.getElementById("settings_shipoutline_inner").value = settings.shipoutline_inner;
    document.getElementById("settings_shipoutline_opacity").value = settings.shipoutline_opacity;
    document.getElementById("settings_show_circle_outline").value = settings.show_circle_outline;

    document.getElementById("settings_track_color").value = settings.track_color;
    document.getElementById("settings_range_color").value = settings.range_color;
    document.getElementById("settings_range_timeframe").value = settings.range_timeframe;
    document.getElementById("settings_range_color_short").value = settings.range_color_short;
    document.getElementById("settings_range_color_dark").value = settings.range_color_dark;
    document.getElementById("settings_range_color_dark_short").value = settings.range_color_dark_short;

    document.getElementById("settings_map_opacity").value = settings.map_opacity;
    document.getElementById("settings_icon_scale").value = settings.icon_scale;
    document.getElementById("settings_track_weight").value = settings.track_weight;

    document.getElementById("settings_tooltipLabelColor").value = settings.tooltipLabelColor;
    document.getElementById("settings_tooltipLabelShadowColor").value = settings.tooltipLabelShadowColor;

    document.getElementById("settings_tooltipLabelColorDark").value = settings.tooltipLabelColorDark;
    document.getElementById("settings_tooltipLabelShadowColorDark").value = settings.tooltipLabelShadowColorDark;
}

function activateTab(b, a) {
    hideMenuifSmall();

    Array.from(document.getElementById("menubar").children).forEach((e) => (e.className = e.className.replace(" active", "")));
    Array.from(document.getElementById("menubar_mini").children).forEach((e) => (e.className = e.className.replace(" active", "")));

    tabcontent = document.getElementsByClassName("tabcontent");

    for (i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";

    document.getElementById(a).style.display = "block";
    if (a === "map") document.getElementById("tableside").style.display = "flex";

    document.getElementById(a + "_tab").className += " active";
    document.getElementById(a + "_tab_mini").className += " active";

    settings.tab = a;
    saveSettings();

    clearInterval(interval);
    refresh_data();
    interval = setInterval(refresh_data, refreshIntervalMs);

    if (a != "map") StopFireworks();
    if (a == "settings") updateSettingsTab();

    if (a == "realtime") {
        if (evtSource == null) {
            evtSource = new EventSource("sse");
            const sseDataDiv = document.getElementById("realtime_content");

            evtSource.addEventListener(
                "nmea",
                function (e) {
                    if (rtCount > 50) {
                        sseDataDiv.innerHTML = "";
                        rtCount = 0;
                    }
                    sseDataDiv.innerText = e.data + "\n" + sseDataDiv.innerText;
                    rtCount = rtCount + 1;
                },
                false,
            );

            evtSource.onerror = function (event) {
                sseDataDiv.innerText = "Connection error. Server is not reachable or reverse web proxy not configured for Server-Side Events.";
            };

            evtSource.onopen = function (event) {
                showNotification("Realtime NMEA connection established");
                sseDataDiv.innerText = "";
            };
        }
    } else {
        if (evtSource != null) {
            evtSource.close();
            showNotification("Realtime NMEA connection closed");
            evtSource = null;
        }
    }
}

function selectMapTab(m) {
    document.getElementById("map_tab").click();
    if (m in shipsDB) showShipcard(m);
}

function selectTab() {
    if (settings.tab == "settings") settings.tab = "stat";

    if (settings.tab != "realtime" && settings.tab != "about" && settings.tab != "map" && settings.tab != "plots" && settings.tab != "ships" && settings.tab != "stat") {
        settings.tab = "stat";
        alert("Invalid tab specified");
    }
    activateTab(null, settings.tab);
    //document.getElementById(settings.tab + "_tab").click();
}

function updateAndroid() {
    if (isAndroid()) {
        var elements = document.querySelectorAll(".noandroid");
        for (var i = 0; i < elements.length; i++) {
            elements[i].style.display = "none";
        }
    } else {
        var elements = document.querySelectorAll(".android");
        for (var i = 0; i < elements.length; i++) {
            elements[i].style.display = "none";
        }
    }
}

function showAboutDialog() {
    const message = `
        <div style="display: flex; align-items: center; margin-top: 10px;">
        <span style="text-align: center; margin-right: 10px;"><i style="font-size: 40px" class="directions_aiscatcher_icon"></i></span>
        <span>
        <a href="https://aiscatcher.org"><b style="font-size: 1.6em;">AIS-catcher</b></a>
        <br>
        <b style="font-size: 0.8em;">&copy; 2021-2023 jvde.github@gmail.com</b>
        </span>
        </div>
        <p>
        AIS-catcher is a research and educational tool, provided under the
        <a href="https://github.com/jvde-github/AIS-catcher/blob/e66a4481e62d8f1775700e5f51fb7ad9ea569a12/LICENSE">GNU GPL v3 license</a>.
        It is not reliable for navigation and safety of life or property.
        Radio reception and handling regulations vary by region, so check your local administration's rules. Illegal use is strictly prohibited.
        </p>
        <p>
        The web-interface gratefully uses the following libraries:
        <a href="https://www.chartjs.org/docs/latest/charts/line.html" rel="nofollow">chart.js</a>,
        <a href="https://www.chartjs.org/chartjs-plugin-annotation/latest/" rel="nofollow">chart.js annotation plugin</a>,
        <a href="https://openlayers.org/" rel="nofollow">openlayers</a>,
        <a href="https://fonts.google.com/icons?selected=Material+Icons" rel="nofollow">Material Design Icons</a>,
        <a href="https://tabulator.info/" rel="nofollow">tabulator</a>,
        <a href="https://github.com/markedjs/marked">marked</a>, and
        <a href="https://github.com/lipis/flag-icons">flag-icons</a>. Please consult the links for the respective licenses.
        </p>`;

    showDialog("About...", message);
}

function showWelcome() {
    if (settings.welcome == true || (settings.welcome == "true" && !isAndroid())) showAboutDialog();

    settings.welcome = false;
    saveSettings();
}

function isAndroid() {
    return settings.android === true || settings.android === "true";
}

// for overwrite and insert code where needed
function main() {
    plugins_main.forEach(function (p) {
        p();
    });
}

function setupAbout() {
    fetchAbout()
        .then((s) => {
            var scriptElement = document.createElement("script");
            scriptElement.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
            document.head.appendChild(scriptElement);

            scriptElement.onload = function () {
                document.getElementById("about_content").innerHTML = marked.parse(s);
            };
        })
        .catch((error) => {
            alert("Error loading about.md: " + error);
            aboutMDpresent = false;
        });
}

addTileLayer("OpenStreetMap", new ol.layer.Tile({
    source: new ol.source.OSM({ maxZoom: 19 })
}));

addTileLayer("Positron", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Positron (no labels)", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Dark Matter", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Dark Matter (no labels)", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Voyager", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Voyager (no labels)", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
    })
}));

addTileLayer("Satellite", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Esri et al.'
        // maxZoom is not specified, so it defaults to the OpenLayers default
    })
}));


addOverlayLayer("OpenSeaMap", new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        attributions: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a>'
    })
}));

addOverlayLayer("NOAA", new ol.layer.Tile({
    source: new ol.source.TileWMS({
        url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer?',
        params: {
            'LAYERS': '1,2,3,4,5,6,7',
            'FORMAT': 'image/png',
            'TRANSPARENT': 'true',
            'VERSION': '1.3.0'
        },
        serverType: 'geoserver'
    })
}));

let mdabout = "This content can be defined by the owner of the station";

console.log("Starting plugin code");
