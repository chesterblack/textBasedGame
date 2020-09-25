// ----- ----- ----- //
//    GLOBAL VARS    //
// ----- ----- ----- //
const body = document.getElementById("body");
const textBox = document.getElementById("text");
const responseBox = document.getElementById("responses");
const dialogueBox = document.getElementById("dialogue");
const drunkennessBox = document.getElementById("drunkenness-counter");
const inventoryBox = document.getElementById('inventory');
const textSpeedInput = document.getElementById('text-speed');
const saveGameOutput = document.getElementById('save-game');
const loadGameInput = document.getElementById('load-game');

const startingRoom = 19;

let stopTyping = false;
let uniqueID = 0;
let speed = 10;

let stats = {
    health: 100,
    maxHealth: 100,
    gold: 50,
    drunkenness: 0,
    attack: 0,
    defence: 0
};

let inventory = [];

let equipped = {
    hands: [
        null,
        null
    ],
    armour: null,
    boots: null,
    gloves: null,
    head: null,
    rings: [
        null,
        null,
        null,
        null
    ],
    amulet: null
};

let roomData;
let autosave = true;

let stock = {};

let saveCode = {
    r: 1,
    h: stats.health,
    mh: stats.maxHealth,
    g: stats.gold,
    s: speed,
    d: stats.drunkenness,
    i: inventory,
    e: equipped
};

// ----- ----- ----- //
//     FUNCTIONS     //
// ----- ----- ----- //
function ajax(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.send(null);

    xhr.onreadystatechange = function () {
        var DONE = 4;
        var OK = 200;
        if (xhr.readyState === DONE) {
            if (xhr.status === OK) {
                callback(xhr.responseText);
            } else {
                console.log('Error: ' + xhr.status);
            }
        }
    };
}

/**
 * 
 * Types out the text given one letter at a time like a typewriter
 * 
 * @param {string} txt Text to be typewritered out
 * @param {object} target Where the text needs to go
 * @param {function} callback What to do once the text has been typed
 */
function typeWriter(txt, target, callback) {
    responseBox.innerHTML = "";
    let i = 0;
    typeText();
    function typeText() {
        if (!stopTyping) {
            if (i < txt.length) {
                target.innerHTML += txt.charAt(i);
                i++;
                setTimeout(typeText, speed);
            } else {
                callback();
            }
        }
    }
}

/**
 * 
 * Creates an option button
 * 
 * @param {string} text the text to go in the button
 * @param {integer} id the room id of where the button goes
 * 
 * @returns {string} the button HTML
 */
function createChoiceBox(text, id) {
    return "<button onclick=\"writeOutRoom("+id+")\">"+text+"</button>";
}

/**
 * 
 * Creates a button to purchase an item
 * 
 * @param {object} item object containing id, price and name of item
 * 
 * @returns {string} the button HTML
 */
function createPurchaseBox(item) {
    return "<button onclick=\"buyItem("+item.id+", "+item.price+")\">"+item.name+" ("+item.price+"gp)</button>";
}

/**
 * 
 * Adds the option buttons to the responses div
 * 
 * @param {array} options array of objects to create the option buttons
 */
function presentChoices(options) {
    setTimeout(() => {
        for (let i = 0; i < options.length; i++) {
            if (options[i].type == "option") {
                responseBox.innerHTML += createChoiceBox(options[i].text, options[i].id);
            } else if (options[i].type == "item") {
                responseBox.innerHTML += createPurchaseBox(options[i]);
            }
        }
    }, speed*20);
}


/**
 * 
 * Creates empty HTML element of the correct colour
 * 
 * @param {object} speaker speaker obj containing color (for text)
 * @returns {element} span element
 */
function createDialogueBox(speaker) {
    let span = document.createElement("span");
    span.classList.add("speaker");
    span.style.color = speaker.color;
    dialogueBox.appendChild(span);
    return span;
}

/**
 * 
 * Write out the i of an array of dialogue objects, then callback itself until all the dialogues are done
 * 
 * @param {array} dialogue array of objects containing speaker obj and message string
 * @param {integer} i which index of the array are we up to
 * @param {function} callback what to do once all the dialogue texts have been written
 */
function writeOutDialogue(dialogue, i, callback) {
    let target;
    if (dialogue.length == i) {
        callback();
    } else {
        target = createDialogueBox(dialogue[i].speaker);
        typeWriter(
            dialogue[i].speaker.name+": "+dialogue[i].message, 
            target, 
            () => {
                writeOutDialogue(dialogue, i+1, callback);
            }
        )
    }
}

/**
 * 
 * Fetches room data from the database based on id given, then prints out the message and presents the options of a room
 * 
 * @param {integer} id the id of the room to present
 * 
 */
function writeOutRoom(id) {
    stopTyping = true;
    let url = '/game.php?function=fetchRoom&room=' + id;
    responseBox.innerHTML = "";
    textBox.innerHTML = "";
    dialogueBox.innerHTML = "";

    ajax(url, (response) => {
        stopTyping = false;
        roomData = JSON.parse(response);

        let roomOptions = roomData.options;

        if (roomOptions){
            for (let choice of roomOptions) {
                choice.type = "option";
            }
        }

        if (roomData.shop) {
            for (let item of roomData.shop) {
                item.type = "item";
                roomOptions.unshift(item);
            }
            stock[roomData.id] = roomData.shop;
        }

        typeWriter(roomData.message, textBox, () => {
            if (roomData.dialogue) {
                writeOutDialogue(roomData.dialogue, 0, () => {
                    presentChoices(roomOptions);
                });
            } else {
                presentChoices(roomOptions);
            }
        });
    });

    endTurn(id);
}

/**
 * 
 * Sobers up by 1, reduces hp by 5 if overhealed
 * 
 * @param {integer} id optional, current room id to pass through to saveGame()
 */
function endTurn(id){
    if (stats.drunkenness > 0) {
        stats.drunkenness--;
    }
    if (stats.health > stats.maxHealth) {
        stats.health -= 5;
    }
    updateStats();
    saveGame(id);
}

/**
 * 
 * Save the current gold, room id, health etc. as a base64 encoded json object
 * 
 * @param {integer} room what room id are we on (optional)
 */
function saveGame(room) {
    if (room) {
        saveCode.r = room;
    }
    saveCode.g = stats.gold;
    saveCode.d = stats.drunkenness;
    saveCode.h = stats.health;
    saveCode.mh = stats.maxHealth;
    saveCode.s = speed;

    saveCode.e = equipped;
    saveCode.i = inventory;

    saveGameOutput.value = btoa(JSON.stringify(saveCode));
    if (autosave) {
        document.cookie = "saveCode="+btoa(JSON.stringify(saveCode));
    } else {
        document.getElementById('autosave').innerHTML = "off";
        document.cookie = "saveCode=; Max-Age=-1;";
    }
}

/**
 * 
 * Open/close the options menu
 */
function toggleMenu(id) {
    let menu = document.getElementById(id);
    if (menu.classList.contains("closed")) {
        menu.classList.remove("closed");
    } else {
        menu.classList.add("closed");
    }
}

/**
 * 
 * Replace current gold, room etc. with loaded base64 encoded string pasted into the load input
 */
function loadGame(saveCode) {
    if (!saveCode) {
        saveCode = loadGameInput.value;
    }
    let decodedOptions = atob(saveCode);
    let loadedOptions = JSON.parse(decodedOptions);
    stats.gold = loadedOptions.g;
    stats.drunkenness = loadedOptions.d;
    stats.health = loadedOptions.h;
    stats.maxHealth = loadedOptions.mh;
    inventory = loadedOptions.i;
    equipped = loadedOptions.e;
    speed = loadedOptions.s;
    textSpeedInput.value = speed;
    writeOutRoom(loadedOptions.r);
}

/**
 * 
 * Copy what's currently in the save input to the clipboard
 */
function copySaveCode() {
  let copyText = saveGameOutput;
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand("copy");
}

/**
 * 
 * Loads a new game using the default options
 */
function newGame() {
    loadGame("eyJyIjoxLCJoIjoxMDAsImciOjUwLCJzIjoxMCwiZCI6MCwiaSI6W3siaWQiOjQsIm5hbWUiOiJEYWdnZXIiLCJlZmZlY3RzIjpbeyJhdHRhY2siOjV9XSwicXVhbnRpdHkiOjF9XX0=");
}

/**
 * 
 * Update the speed variable that determines how fast the text will type
 */
textSpeedInput.addEventListener("change", () => {
    speed = textSpeedInput.value;
    saveGame();
})

/**
 * 
 * Autoload a game saved to the cookie, otherwise load the first room
 */
window.onload = () => {
    let autosaveSet = document.cookie.match(new RegExp('(^| )autosave=([^;]+)'));
    if (autosaveSet[2] == "true") {
        let savedGame = document.cookie.match(new RegExp('(^| )saveCode=([^;]+)'));
        autosave = true;
        if (savedGame) {
            loadGame(savedGame[2]);
        } else {
            writeOutRoom(startingRoom);
        }
    } else {
        autosave = false;
        writeOutRoom(startingRoom);
    }

    updateStats();
}

/**
 * 
 * Toggles whether data is saved into a cookie to be automatically loaded
 */
function toggleAutosave() {
    autosave = autosave ? false : true;
    document.cookie = "autosave="+autosave;
    if (autosave) {
        document.getElementById('autosave').innerHTML = "on";
    } else {
        document.getElementById('autosave').innerHTML = "off";
    }
}

function toggleEquipped(item) {
    let inventoryItem = inventory[inventory.findIndex((invItem) => {
        return invItem.uid == item.uid;
    })];

    if (inventoryItem.equipped) {
        if (equipped[item.slot] != null && Array.isArray(equipped[item.slot])) {
            for (let i in equipped[item.slot]) {
                if (equipped[item.slot][i] && equipped[item.slot][i].uid == item.uid) {
                    equipped[item.slot][i] = null;
                    break;
                }
            }
        } else {
            equipped[item.slot] = null;
        }
        applyItem(item, false);
        inventoryItem.equipped = false;
    } else {
        let freeSlot = checkSlotIsFree(item.slot);
        if (freeSlot === true) {
            applyItem(item);
            inventoryItem.equipped = true;
            equipped[item.slot] = item;
        } else if (freeSlot !== false) {
            applyItem(item);
            inventoryItem.equipped = true;
            equipped[item.slot][freeSlot] = item;
        } else {
            alert("Sorry, you can't equip another item in the "+item.slot+" slot");
        }
    }
    updateStats();
}

function checkSlotIsFree(slot) {
    if (equipped[slot] != null && Array.isArray(equipped[slot])) {
        for (let item in equipped[slot]) {
            if (equipped[slot][item] == null) {
                return item;
            }
        }
        return false;
    } else {
        return equipped[slot] == null;
    }
}

/**
 * 
 * Updates visible stat counters (gold, health etc.) and inventory, applies passive effects from everything equipped in inventory
 */
function updateStats() {
    for (let key in stats) {
        document.getElementById(key).innerHTML = stats[key];
    }

    inventoryBox.innerHTML = "";
    if (inventory[0]){
        for (let item of inventory) {
            let newItem = document.createElement("div");
            newItem.classList.add("item");
            newItem.innerHTML = item.name;
            if (item.quantity > 1) {
                newItem.innerHTML += " x"+item.quantity;
            }
            newItem.dataset.itemid = item.id;
            let itemInfoBox = document.createElement("ul");
            itemInfoBox.classList.add("item-info");

            let itemSlot = document.createElement("li");
            itemSlot.classList.add("item-slot");
            if (item.slot) {
                itemSlot.innerHTML = item.slot;
                itemInfoBox.appendChild(itemSlot);
            }
            if (item.consumable) {
                itemSlot.innerHTML = "Consumable";
            }
            itemInfoBox.appendChild(itemSlot);

            for (let effect in item.effects) {
                effect = Object.entries(item.effects[effect])[0];
                let effectElement = document.createElement("li");
                let modifier;
                if (effect[1] > 0) {
                    modifier = "+";
                }
                effectElement.innerHTML = effect[0] + ": "+modifier+effect[1];
                itemInfoBox.appendChild(effectElement);
            }

            if (item.consumable) {
                let consumeButton = document.createElement("button");
                consumeButton.innerHTML = "Use";
                consumeButton.addEventListener("click", (e) => {
                    applyItem(item);
                    deleteItem(item);
                });
                newItem.appendChild(consumeButton);
            }
            
            if (item.equippable) {
                let equipButton = document.createElement("button");
                if (item.equipped) {
                    newItem.classList.add("equipped");
                    equipButton.innerHTML = "Unequip";
                } else {
                    newItem.classList.remove("equipped");
                    equipButton.innerHTML = "Equip";
                }
                equipButton.classList.add("equip");
                equipButton.addEventListener("click", (e) => {
                    toggleEquipped(item);
                });
                newItem.appendChild(equipButton);

            }

            newItem.appendChild(itemInfoBox);

            inventoryBox.appendChild(newItem);
        }
    }

    if (stats.drunkenness > 0) {
        body.style.filter = "blur("+(stats.drunkenness / 10)+"px)";
        drunkennessBox.style.display = "block";
    } else {
        body.style.filter = "blur(0)";
        drunkennessBox.style.display = "none";
    }

    saveGame();
}

/**
 * 
 * Removes an item from the inventory based on it's id
 * 
 * @param {object} item only required attribute is id
 */
function deleteItem(item) {
    let invItem = inventory.find(invItem => invItem.id == item.id);
    if (invItem.quantity > 1) {
        invItem.quantity--;
    } else {
        inventory = inventory.filter(i => i.id != invItem.id);
    }

    updateStats();
}

/**
 * 
 * Applies any effects an item has
 * 
 * @param {object} item containing array of effects
 */
function applyItem(item, positive = true) {
    for (let effect of item.effects) {
        for (let stat in effect) {
            if (positive) {
                stats[stat] += effect[stat];
            } else {
                stats[stat] -= effect[stat];
            }
        }
    }

    updateStats();
}

/**
 * 
 * Add an item to the inventory and reduce current money by it's price
 * 
 * @param {integer} itemID The id of the item being purchased
 * @param {integer} price how much the item costs
 */
function buyItem(itemID, price) {
    let url = '/game.php?function=fetchItem&item=' + itemID;

    ajax(url, (response) => {
        item = JSON.parse(response);
        item.uid = uniqueID;
        uniqueID++;

        if (stats.gold < price) {
            alert("Insufficient funds");
        } else {
            stats.gold -= price;

            let alreadyOwns = inventory.find(invItem => invItem.id == item.id);
            if (alreadyOwns && item.consumable) {
                alreadyOwns.quantity++;
            } else {
                item.quantity = 1;
                inventory.push(item);
            }
    
            pingUpdateMessage('inv-button', "+ "+item.name);

            if (price != 0) {
                pingUpdateMessage('gold', "-"+price+"gp");
            }

            updateStats();
        }
    });
}

/**
 * 
 * Adds a little message to an element that fades away to nothing
 * 
 * @param {string} id id of the element getting the ping
 * @param {string} message what does the ping say?
 */
function pingUpdateMessage(id, message) {
    let parentElement = document.getElementById(id);
    let grandparentElement = parentElement.parentElement;
    let element = document.createElement("div");
    element.classList.add('ping');
    element.innerHTML = message;
    grandparentElement.appendChild(element);
    setTimeout(() => {
        element.classList.add('fade')
        setTimeout(() => {
            grandparentElement.removeChild(element);
        }, 1500);
    }, 100);
}