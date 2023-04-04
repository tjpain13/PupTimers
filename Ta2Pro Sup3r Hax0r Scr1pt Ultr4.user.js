// ==UserScript==
// @name        Ta2Pro Sup3r Hax0r Scr1pt Ultr4
// @version     0.666s
// @include     https://tagpro.koalabeast.com/game
// @include     http://*.jukejuice.com:*
// @include     http://*.newcompte.fr:*
// @author      Despair
// ==/UserScript==

var Config = {
	// - tile display - possible values :
	// 0 - timeleft largetext , timeat smalltext
	// 1 - timeleft largetext
	// 2 - timeat largetext , timeleft smalltext
	// 3 - timeat largetext
	// 4 - timeat largetext and timeleft smalltext , timeleft largetext and timeat smalltext when 10 sec left
	// 5 - timeat largetext , timeleft largetext and timeat smalltext when 10 sec left
	// 6 - timeat largetext , timeleft largetext when 10 sec left
	tileDisplay : 0,

	// - warning type - possible values :
	// 0 - fill
	// 1 - border
	// 2 - none
	warningType : 1,



	// - show timeAt for timers less than 20 sec
	alwaysAt : false,

	// - small text position changes at halfway-point instead of near bottom
	centerBoundText : false,

	// - hide player powerup count when spectating
	hideCountSpectate : true,



	// - show global timers under your ball
	showGlobal : true,

	// - show offscreen powerup timers at edge of screen
	showFloaters : true,

	// - show powerup time remaining estimate on each player
	showPlayerTimers : true,

	// - show powerup count for each player
	showPlayerPupCount : false,



	// - enable alternate fill colors
	customColors : false,

	// - override timer fill colors - use hexadecimal format
	overrideColor : {
		// - example
		example : 0xffffff,

		// - player spawn
		redball : false,
		blueball : false,

		// - tiles
		boost : false,
		boostred : false,
		boostblue : false,
		powerup : false,
		bomb : false,
		portal : false,

		// - warning border
		warnborder : false,
	},



	// - disable global, floaters, player timers and player pup count if map powerup count is above this value
	maxPupDetailedTracking : 8,
};

var Helper = {
	setValue : function(target, prop, value, action){
		if( target[prop] != value ){
			target[prop] = value;
			if(action) action();
		}
	},
	setValueDelta : function(target, prop, value, delta, action){
		if( Math.abs( target[prop] - value ) >= delta ){
			target[prop] = value;
			if(action) action();
		}
	},
	isValueReady : function(value){
		if( 6 < value && value < 7 ){
			return true;
		}

		switch(value){
			case 5: case 10: case 13: case 14: case 15:{
				return true;
			}
			default:{
				return false;
			}
		}
	},
	isStandardMapUpdate : function(value){
		var valid = [500,510,600,610,620,630,640,1000,1010,1300,1310,1400,1410,1500,1510];

		return valid.indexOf( Math.round( value * 100 ) ) != -1;
	},
	isWarningMapUpdate : function(value){
		var warn = [511,611,621,631,641,1011,1311,1411,1511];

		return warn.indexOf( Math.round( value * 100 ) ) != -1;
	},
	standardizeWarning : function(value){
		return Math.round( value * 10 ) / 10;
	},
	getTimeSince : function(ts){
		return Date.now() - ts;
	},
	getTimeLeftText : function(ms){
		if( ms === 0 ) return '';
		return '' + ms > 9999 ? Math.floor( ms / 1000 ) : ( Math.floor( ms / 100 ) / 10 ).toFixed(1) ;
	},
	getTimeAtText : function(n){
		return ( n > 9 ? '' : '0' ) + n;
	},
	// camera can see tile
	tileOnScreen : function(x, y, f){
		var player = Database.position, delta = 20 / tagpro.zoom;

		if( tagpro.spectator && !tagpro.viewport.followPlayer ) return true;

		if( f === true && Config.showFloaters ) delta *= -1;

		return (
			Math.abs( ( player.x - x ) * ( 40 / tagpro.zoom ) ) < ( tagpro.renderer.canvas.width / 2 ) + delta &&
			Math.abs( ( player.y - y ) * ( 40 / tagpro.zoom ) ) < ( tagpro.renderer.canvas.height / 2 ) + delta
		);
	},
	// check if map update was live
	wasLiveUpdate : function(x, y, p){
		if( tagpro.spectator ) return true;

		return  Math.abs( p.x - x ) < 16.25 && Math.abs( p.y - y ) < 10.25;
	},
	// if tile is near bottom
	tileNearBottom : function(y){
		if( tagpro.spectator && !tagpro.viewport.followPlayer ) return false;

		return ( Database.position.y - y ) < ( Config.centerBoundText ? 0 : ( ( -tagpro.renderer.canvas.height / 2 ) / ( 40 / tagpro.zoom ) ) + 1 );
	},
	// player can see tile(in update range)
	tileLiveForPlayer : function(x, y){
		var player = Database.position;

		if( tagpro.spectator ) return true;

		return  Math.abs( player.x - x ) < 16.25 && Math.abs( player.y - y ) < 10.25;
	},
	// get display container
	getPixiContainer : function(){
		if( Database.legacyRender ){
			return new PIXI.DisplayObjectContainer();
		}else{
			return new PIXI.Container();
		}
	},
};

var Logic = {
	readMapData : function(map){
		Logic.parseMapData( map );
		Database.state = 1;
	},
	parseMapData : function(data){
		var i, j;

		// set custom colors
		if( Config.customColors ) Logic.handleCustomColors();

		// go through every tile
		for(i = 0; i < data.length; i++){
			for(j = 0; j < data[i].length; j++){
				// check if tile is something we should have timers on
				Logic.parseTileData( i , j , data[i][j] );
			}
		}

		// disable details on trigger
		if( Database.pupCount > Config.maxPupDetailedTracking ){
			Config.showGlobal = false;
			Config.showFloaters = false;
			Config.showPlayerTimers = false;
			Config.showPlayerPupCount = false;
		}
	},
	handleCustomColors : function(){
		var CO = Config.overrideColor, DC = Database.colorTable, prop;

		for( prop in DC ){
			if( CO[prop] ) DC[prop] = CO[prop];
		}
	},
	parseTileData : function(x, y, data){
		var prop;

		//console.log( 'Logic.parseTileData : {x: '+x+', y: '+y+', value: '+data+'}' );

		switch( Math.floor(data) ){
			case 5 : prop = ['boost', 10000, Database.colorTable.boost]; break;
			case 6 : prop = ['powerup', 60000, Database.colorTable.powerup]; break;
			case 10: prop = ['bomb', 30000, Database.colorTable.bomb]; break;
			case 13: prop = ['portal', false, Database.colorTable.portal]; break;
			case 14: prop = ['boostred', 10000, Database.colorTable.boostred]; break;
			case 15: prop = ['boostblue', 10000, Database.colorTable.boostblue]; break;

			default: return;
		}

		Logic.createPOI(x, y, prop, data);
	},
	createPOI : function(x, y, prop, data){
		var POI = Database.createPOIEntry( x , y , prop , data );
	},



	readSocketMessage : function(data){
		Database.socketQueue.push( data );
	},



	tick : function(){
		// handle state
		if( !Logic.handleState() ) return;

		// create renderer layers
		Logic.handleRendererLayers();

		// update player camera position
		// - not used during map update socket events as they already contain player position
		Logic.updatePlayerPosition();

		// process socket queue
		Logic.handleQueuedSocketMessages();

		// handle tile timers
		Logic.updateAllPOI();
		Logic.updateAllTemp();

		// create player data
		Logic.handlePlayerData();

		// handle global timers
		Logic.processGlobalQueue();
		Logic.updateAllGlobal();
		Logic.updateAllPlayers();
	},



	handleState : function(){
		switch( Database.state ){
			case 0 : {// init

				return false;
			}
			case 1 : {// map
				Database.state = 2;
				console.log( 'TSHSU - start tick');

				return false;
			}
			case 2 : {// tick
				Logic.updateState();

				return false;
			}
			case 3 : {// pre game
				Logic.updateState();

				return true;
			}
			case 4 : {// in game
				Logic.updateState();

				return true;
			}
			case 5 : {// post game


				return false;
			}
			default: {// invalid
				console.log( 'TSHSU - invalid state ('+Database.state+')' );
				Database.state = 5;

				return false;
			}
		}
	},
	updateState : function(){
		switch( tagpro.state ){
			case 3 : {
				Database.state = 3;
				Database.preGame = true;
				break;
			}
			case 1 : {
				if( Database.state == 4 ) break;

				Logic.getEndTime();

				if( Database.endTime ){
					// activate all non-ready timers
					Logic.gameStartActivation();

					Database.state = 4;
				}

				break;
			}
			case 2 : {
				Database.state = 5;
				break;
			}
			default: {

			}
		}
	},
	getEndTime : function(){
		if( !tagpro.gameEndsAt ) return;

		// game ends more than 3 seconds from now
		// maybe gameEndsAt has not updated
		if( tagpro.gameEndsAt - Date.now() > 3000 ){
			Database.endTime = tagpro.gameEndsAt;
		}
	},
	gameStartActivation : function(){
		var i, count;

		i = 0; count = Database.tiles.length;

		// activate all non-ready timers
		while(i < count){
			if( !Database.tiles[i].ready ){
				Logic.startPOI( Database.tiles[i] , true );
				Database.tiles[i].timeStamp = Date.now();
				Database.tiles[i].known = Database.preGame;

				// was in pregame and is pup
				if( Database.preGame && Database.tiles[i].pupId > -1 ){
					Database.global.push( [ Date.now() , 60000 , [Database.tiles[i].pupId] , false ] );
				}
			}

			i++;
		}

		Logic.recalcGlobalCounts();
	},



	handleRendererLayers : function(){
		if( Database.state >= 2 ){
			if( !Renderer.timerLayer ){
				Renderer.timerLayer = Helper.getPixiContainer();

				tagpro.renderer.layers.TSHSU_timers = Renderer.timerLayer;
				tagpro.renderer.gameContainer.addChildAt( tagpro.renderer.layers.TSHSU_timers , 3 );
			}
			if( !Renderer.floaterLayer ){
				Renderer.floaterLayer = Helper.getPixiContainer();

				tagpro.renderer.layers.ui.TSHSU_floaters = Renderer.floaterLayer;
				tagpro.renderer.layers.ui.addChild( tagpro.renderer.layers.ui.TSHSU_floaters );
			}
			if( !Renderer.isReady ){
				if( Renderer.timerLayer && Renderer.floaterLayer ) Renderer.isReady = true;
				console.log( 'TSHSU - renderer ready');
			}
		}
	},



	handleQueuedSocketMessages : function(){
		while( Database.socketQueue.length ){
			// process front of queue
			Logic.handleSocketMessage( Database.socketQueue[0] );

			// remove first in queue
			Database.socketQueue.shift();
		}
	},
	handleSocketMessage : function(data){
		switch( data.type ){
			case 'mapupdate' : {
				Logic.handleMapUpdate( data );
				return;
			}
			case 'spawn' : {
				Logic.handleSpawn( data );
				return;
			}
			case 'end' : {
				Logic.handleEnd( data );
				return;
			}
			case 'p' : {
				Logic.handleP( data );
				return;
			}
			default : return;
		}
	},
	handleMapUpdate : function(data){
		var i, c, x, y, warn;

		i = 0; c = data.data.length;

		p = data.pos; t = data.time;

		// loop through all tiles that are updating
		while(i < c){
			x = parseInt( data.data[i].x );
			y = parseInt( data.data[i].y );

			// check if POI at location
			if( !Database.locate[x] || !Database.locate[x][y] ){
				i++; continue;
			}

			v = parseFloat( data.data[i].v );

			warn = Helper.isWarningMapUpdate( v );

			// - check if valid value
			if( Helper.isStandardMapUpdate( v ) || warn ){
				// update POI values
				Logic.mapUpdatePOI( x , y , { v : v , p : data.pos , t : data.time } , warn );
			}

			i++;
		}
	},
	handleSpawn : function(data){
		if( Database.state != 4 ) return;
		Database.createTempEntry( data.data , data );
	},
	handleEnd : function(data){
		Database.state = 5;
	},
	handleP : function(data){
		var i, count;

		i = 0; count = data.data.u.length;

		while(i < count){
			Logic.updatePlayerP( data.data.u[i] , data.time );

			i++;
		}
	},

	mapUpdatePOI : function(x, y, data, warn){
		var POI = Database.locate[x][y];

		if( !warn ){
			// standard update
			POI.inWarnState = false;

			// flag for update
			POI.updateNeeded = true;

			// push curr values as prev values
			POI.prev.ts = POI.curr.ts;
			POI.prev.v = POI.curr.v;
			POI.prev.k = POI.curr.k;

			// apply update to curr values
			POI.curr.ts = data.t;
			POI.curr.v = data.v;
			POI.curr.k = Helper.wasLiveUpdate(x, y, data.p);
		}else{
			// warning update
			POI.lastWarnAt = data.t;
			POI.inWarnState = true;

			if( !POI.ready ){
				// sync and warn

				// is live update
				if( Helper.wasLiveUpdate(x, y, data.p) && POI.timeMax ){
					POI.timeStamp = ( data.t + Math.min( 3000 , POI.timeMax ) - POI.timeMax );
					POI.timeAtText = false;
					POI.known = true;
				}
			}else{
				// switch ready state

				// flag for update
				POI.updateNeeded = true;

				// push curr values as prev values
				POI.prev.ts = POI.curr.ts;
				POI.prev.v = POI.curr.v;
				POI.prev.k = POI.curr.k;

				// apply update to curr values
				POI.curr.ts = POI.timeMax ? ( data.t + Math.min( 3000 , POI.timeMax ) - POI.timeMax ) : data.t;
				POI.curr.v = Helper.standardizeWarning( data.v );
				POI.curr.k = Helper.wasLiveUpdate(x, y, data.p);
			}
		}
	},
	updatePlayerP : function(data, ts){
		// powerup update
		if( data['s-powerups'] ){
			Database.globalQueue.push( [ data.id , data['s-powerups'] , ts ] );
		}
	},



	updatePlayerPosition : function(){
		var player = tagpro.players[ tagpro.playerId ];

		Database.position.x = player.x / 40;
		Database.position.y = player.y / 40;
	},



	updateAllPOI : function(){
		var i = 0, count = Database.tiles.length;

		while(i < count){
			Logic.updatePOI( Database.tiles[i] );

			i++;
		}

		Logic.globalCapPupTiles();
	},
	updatePOI : function(POI){
		// update POI state
		Logic.statePOI( POI );
		// update POI graphics
		Logic.graphicsPOI( POI );
		// update POI tracking
		Logic.trackingPOI( POI );
	},

	statePOI : function(POI){
		// recent update
		if( POI.updateNeeded ){
			POI.updateNeeded = false;

			// set values to curr values and state
			POI.value = POI.curr.v;
			POI.ready = Helper.isValueReady( POI.value );

			if( POI.ready ){
				// tile is ready to use, reset
				Logic.resetPOI( POI );

				// remove ready pup from globals
				if( POI.pupId > -1 ) Logic.removeKnownFromGlobal( POI.pupId , true );
			}else{
				// tile is not ready, start timer
				Logic.startPOI( POI , POI.curr.k );
			}
		}

		// set time left
		Logic.timeLeftPOI( POI );

		// time is up
		Logic.timeOutPOI( POI );

		// set time at
		Logic.timeAtPOI( POI );

		// set if timer should be displayed
		POI.active = POI.timeLeft > 0;
	},
	graphicsPOI : function(POI){
		// create sprites
		Logic.spritePOI( POI );

		// set visible
		Logic.setVisibility( POI );

		// stop if not active
		if( !POI.active ){
			if( !POI.debug.timeStamp ) return;
		}

		// update graphics
		Renderer.updateDebug( POI );

		Renderer.updateText( POI );
		Renderer.updateCircle( POI );
		Renderer.updateFloater( POI );
	},
	trackingPOI : function(POI){
		var isLive = Helper.tileLiveForPlayer( POI.x , POI.y );

		// track live state
		Logic.liveStatePOI( POI , isLive );

		// get POI timeMax
		Logic.getTimeMax( POI );

		// fix POI state
		if( Database.state == 4 ) Logic.fixStatePOI( POI );
	},

	timeLeftPOI : function(POI){
		POI.timeLeft = POI.timeStamp ? Math.max( 0 , POI.timeMax - Helper.getTimeSince( POI.timeStamp ) ) : 0;
		POI.timeLeftText = Helper.getTimeLeftText( POI.timeLeft );

		if( POI.debug.timeStamp ){
			POI.debug.timeLeft = POI.debug.timeStamp ? Math.max( 0 , POI.debug.timeMax - Helper.getTimeSince( POI.debug.timeStamp ) ) : 0;
		}
	},
	timeOutPOI : function(POI){
		if( POI.timeStamp && POI.timeLeft === 0 ){
			Logic.resetPOI( POI );
		}

		if( POI.debug.timeStamp && POI.debug.timeLeft === 0 ){
			POI.debug.timeStamp = false;
		}
	},
	timeAtPOI : function(POI){
		var timeAt;

		if( !POI.timeAtText && POI.timeStamp ){
			timeAt = Math.floor( ( ( Database.endTime - POI.timeStamp - POI.timeMax + 60000 ) % 60000 ) / 1000 );
			POI.timeAtText = Helper.getTimeAtText( timeAt );
		}
	},

	resetPOI : function (POI){
		POI.timeStamp = false;
		POI.timeAtText = false;

		POI.known = false;
	},
	startPOI : function(POI, known){
		known = typeof known == 'undefined' ? true : known;

		if( !POI.timeMax ) return;

		if( !POI.ready ) POI.timeStamp = POI.curr.ts;
		else POI.timeStamp = Date.now();

		POI.timeAtText = false;

		POI.known = known;
	},
	forceActivePOI : function(POI){
		POI.known = false;
		POI.timeStamp = Date.now();
		POI.timeAtText = false;
		POI.timeLeft = POI.timeMax;
	},

	spritePOI : function(POI){
		if( !POI.sprite ) POI.sprite = Renderer.timerSprite(POI);
		if( POI.type == 'powerup' && !POI.floater ){
			POI.floater = Renderer.floaterSprite(POI);
		}
	},
	// set POI and floater visibility
	setVisibility : function(POI){
		if( !POI.active ){
			// hide inactive POI
			if( POI.sprite.visible ) POI.sprite.visible = false;
			if( POI.floater && POI.floater.visible ) POI.floater.visible = false;
		}else{
			if( Helper.tileOnScreen( POI.x , POI.y , !!POI.floater ) ){
				// tile is on screen
				if( !POI.sprite.visible ) POI.sprite.visible = true;
				if( POI.floater && POI.floater.visible ) POI.floater.visible = false;
			}else{
				// tile not on screen
				if( POI.sprite.visible ) POI.sprite.visible = false;
				if( POI.floater && !POI.floater.visible ) POI.floater.visible = true;
			}
		}

		if( POI.debug.timeStamp ){
			if( !POI.sprite.visible ) POI.sprite.visible = true;
		}

		// config disables floaters
		if( POI.floater && !Config.showFloaters ) POI.floater.visible = false;
	},

	liveStatePOI : function(POI, isLive){
		Helper.setValue( POI , 'live' , isLive , function(){
			// POI just became live
			if( POI.live ){
				POI.changedSinceLive = false;
				POI.liveSince = Date.now();
				POI.wasReadyOnLoad = Helper.isValueReady( POI.value );

				// remove ready pup from globals
				if( POI.pupId > -1 && POI.ready ) Logic.removeKnownFromGlobal( POI.pupId , true );
			}
			// POI just unloaded
			else{
				POI.changedSinceLive = false;
			}
		});

		if( POI.live ){
			// POI has changed state while loaded
			if( POI.ready != POI.wasReadyOnLoad && !POI.changedSinceLive ){
				POI.changedSinceLive = true;
			}

			// set last seen state
			Helper.setValue( POI , 'liveReady' , POI.ready , function(){
				if( POI.ready ){
					POI.switchedReady = Date.now();
				}else{
					POI.switchedUnready = Date.now();
				}
			});
		}else{
			if( POI.liveReady != -1 ){
				POI.liveReady = -1;
				POI.switchedReady = false;
				POI.switchedUneady = false;
			}
		}
	},
	getTimeMax : function(POI){
		if( POI.timeMax ) return;

		// is live - track progress
		if( POI.live ){
			// progress if ready
			if( POI.progress === 0 ){
				if( POI.ready ){
					POI.progress = 1;
				}
			}

			// progress if poi was used
			else if( POI.progress === 1 ){
				if( !POI.ready ){
					POI.progress = 2;
				}
			}

			// progress if poi is ready
			else if( POI.progress == 2 ){
				if( POI.ready ){
					POI.progress = 0;

					POI.timeMax = POI.curr.ts - POI.prev.ts;
				}
			}
		}

		// is not live - reset progress
		else{
			if( POI.progress !== 0 ){
				POI.progress = 0;
			}
		}
	},
	fixStatePOI : function(POI){
		if( !POI.timeMax || !POI.live ) return;

		if( POI.ready ){
			// POI is ready and has a timer
			if( POI.active ){
				Logic.resetPOI( POI );
			}
		}else{
			// POI not ready and has no timer
			if( !POI.active ){
				Logic.startPOI( POI , false );

				// set timestamp
				// sometimes triggers on frame where timer expires but tile hasnt spawned yet

				// set to livesince
				if( Helper.getTimeSince( POI.liveSince ) < POI.timeMax ){
					POI.timeStamp = POI.liveSince;
				// set to now
				}else{
					POI.timeStamp = Date.now();
				}
			}
		}

		// is warning - set to max 3 sec
		if( POI.inWarnState && POI.timeLeft > 3000 ){
			//POI.debug.timeStamp = Date.now();
			POI.timeStamp = Date.now() + Math.min( 3000 , POI.timeMax ) - POI.timeMax;
		}
	},

	// truncate pupTiles timestamp
	globalCapPupTiles : function(){
		var validGlobals = 0, invalidCount = 0, i, count, POI;

		// no globals
		if( Database.global.length === 0 ) return;

		// more than 1 pup
		if( Database.pupCount <= 1 ) return;

		// last global is too recent
		if( Database.global[ Database.global.length - 1 ][1] > 59000 ) return;

		// count valid globals
		i = 0; count = Database.global.length;

		while( i < count ){
			if( Database.global[i][2].length > 0 ) validGlobals++;
			else invalidCount++;

			i++;
		}

		// invalid global detected - return
		if( invalidCount > 0 ) return;

		// liveready + valid = pupcount
		if( Logic.countReadyLivePupTiles() + validGlobals == Database.pupCount ){
			// cap pupTiles unknown to last global
			Logic.autoSetUnknownTimePupTiles();
		}
	},
	countReadyLivePupTiles : function(){
		var out = 0, i = 0, tile;

		while( i < Database.pupCount ){
			tile = Database.pupTiles[i];

			if( tile.live && tile.ready ) out++;

			i++;
		}

		return out;
	},
	autoSetUnknownTimePupTiles : function(){
		var i = 0, POI;

		while( i < Database.pupCount ){
			POI = Database.pupTiles[i];

			// skip live ready
			if( POI.live && POI.ready ){ i++; continue; }

			// activate inactive POI
			if( !POI.active ) Logic.forceActivePOI( POI );

			// POI is unknown
			if( !POI.known ) Logic.autoSetUnknownTimePupTile( POI );

			i++;
		}
	},
	autoSetUnknownTimePupTile : function(POI){
		var i, glo;

		// loop : all global timers
		i = Database.global.length - 1;

		// go through and find the global timestamp that POI timestamp can 'round down' to
		while( i > -1 ){
			glo = Database.global[i];

			// timestamp matches global timer
			// POI already rounded down
			if( POI.timeStamp == glo[0] ) break;

			// round down POI timestamp to global timestamp

			// POI timestamp > glo timestamp
			if( POI.timeStamp > glo[0] ){
				// set POI timestamp
				POI.timeStamp = glo[0];
				POI.timeAtText = false;

				break;
			}

			// timestamp is less than global[0]
			if( i === 0 && POI.timeStamp < glo[0] ){
				// set POI timestamp
				POI.timeStamp = glo[0];
				POI.timeAtText = false;

				break;
			}

			i--;
		}
	},



	updateAllTemp : function(){
		var i;

		if( !Database.temp.length ) return;

		for(i = 0; i < Database.temp.length; i++){
			if( !Database.temp.length ) break;

			// update temp
			Logic.updateTemp( Database.temp[i] );

			// remove expired temp
			if( Logic.removeTemp( i ) ){
				i--; continue;
			}
		}
	},
	removeTemp : function(index){
		var temp = Database.temp[ index ];

		if( temp.timeLeft !== 0 ) return false;

		Renderer.timerLayer.removeChild( temp.sprite );
		Database.temp.splice( index , 1 );

		return true;
	},
	updateTemp : function(temp){
		// update POI state
		Logic.stateTemp( temp );
		// update POI graphics
		Logic.graphicsTemp( temp );
	},

	stateTemp : function(temp){
		temp.timeLeft = Math.max( 0 , temp.timeMax - Helper.getTimeSince( temp.timeStamp ) );
		temp.text = Helper.getTimeLeftText( temp.timeLeft );
	},
	graphicsTemp : function(temp){
		Renderer.updateTempText( temp );
		Renderer.updateTempCircle( temp );
	},



	handlePlayerData : function(){
		var id;

		// loop through all players
		for(id in tagpro.players){
			// create player data
			if( !Database.player[id] ){
				Database.createPlayerData( id );
				Database.player[id].pups = tagpro.players[id]['s-powerups'] || 0;
			}
			// get ready
			if( !Database.player[id].ready ){
				// player data has existed for over 1 second
				if( Helper.getTimeSince( Database.player[id].init ) > 1000 ){
					Database.player[id].ready = true;
				}
			}
		}
	},



	processGlobalQueue : function(){
		while( Database.globalQueue.length ){
			// process front of queue
			Logic.updatePlayerPowerupState( Database.globalQueue[0] );

			// remove first in queue
			Database.globalQueue.shift();
		}
	},
	updatePlayerPowerupState : function(data){
		var id = data[0], count = data[1], ts = data[2];

		// no player database entry
		if( !Database.player[id] ){
			console.log( 'TSHSU - No player data for id '+id );
			return;
		}

		var player = Database.player[id], p;

		// create timer for each increment using current timestamp
		while(player.pups < count){
			if( player.ready ){
				p = Logic.getPossibleTiles(ts);

				player.timers.push( [ ts , 20000 ] );
				Database.global.push( [ ts , 60000 , p , id ] );

				if( p.length === 1 ) Logic.removeKnownFromGlobal( p[0] );

				Logic.recalcGlobalCounts();
			}

			player.pups++;
		}
	},
	getPossibleTiles : function(ts){
		var tile, i, output = [], recent = [];

		for(i = 0; i < Database.pupCount; i++){
			tile = Database.pupTiles[i];

			// check if known and grabbed recently
			//if( tile.timeLeft > 59900 && tile.known ) return [ tile.pupId ];
			if( tile.known && ts - tile.timeStamp <= 75 && ts - tile.timeStamp >= -25 ) recent.push( tile.pupId );

			// get unknown and offscreen pups
			if( !tile.live && !tile.known ) output.push( tile.pupId );
		}

		if( recent.length ) return recent;
		return output;
	},
	removeKnownFromGlobal : function(n, kill){
		var i, timer;

		if( typeof kill == 'undefined' ) kill = false;

		// remove known pup id from all global timers
		for(i = 0; i < Database.global.length ; i++){
			timer = Database.global[i];

			// timer has multiple possible tiles or guarantee remove and not recent
			if( timer[2].length > 1 || ( kill && timer[1] < 59500 ) ){
				// timer has known in possible tiles
				if( timer[2].indexOf(n) != -1 ){
					// remove known from possible tiles
					timer[2].splice( timer[2].indexOf(n) , 1 );
				}
			}
		}
	},
	recalcGlobalCounts : function(){
		var i;

		Database.globalCounts[0] = 0;
		Database.globalCounts[1] = 0;

		for(i = 0; i < Database.global.length; i++){
			if( Database.global[i][2].length > 0 ){
				Database.globalCounts[0]++;
			}else{
				Database.globalCounts[1]++;
			}
		}
	},



	updateAllGlobal : function(){
		var i;

		for(i = 0; i < Database.global.length; i++){
			if( !Database.global.length ) break;

			// update global
			Logic.updateStateGlobal( Database.global[i] );

			// remove expired global
			if( Logic.removeGlobal( i ) ){
				i--; continue;
			}
		}

		Logic.updateGraphicsGlobal();
	},
	removeGlobal : function(index){
		var glo = Database.global[ index ];

		if( glo[1] > 100 ) return false;

		// 1 possible , set offscreen poi unknown
		if( glo[2].length === 1 ){
			if( !Database.pupTiles[ glo[2][0] ].live ) Database.pupTiles[ glo[2][0] ].known = false;
		}

		Database.global.splice( index , 1 );

		Logic.recalcGlobalCounts();

		return true;
	},
	updateStateGlobal : function(glo){
		var tile;

		// if 1 possible
		if( glo[2].length === 1 ){
			tile = Database.pupTiles[ glo[2] ];

			// if possible is unknown set known
			if( !tile.known ){
				tile.known = true;
				tile.timeAtText = false;
				tile.timeStamp = glo[0];
			}
		}

		// set time left
		glo[1] = Math.max( 0 , 59900 - Helper.getTimeSince( glo[0] ) );
	},
	updateGraphicsGlobal : function(){
		var GL;

		Logic.handleGlobalListSprites();

		GL = Renderer.floaterLayer.globalList;

		// set visibility
		Helper.setValue( GL , 'V_visible' , Config.showGlobal , function(){
			GL.visible = Config.showGlobal;
		});

		if( !GL.visible ) return;

		// set text
		Renderer.setGlobalText();

		// set position
		GL.x = Math.round( tagpro.renderer.canvas.width / 2 - 20 );

		if( !tagpro.spectator ){
			GL.y = Math.round( tagpro.renderer.canvas.height / 2 + 30 );
		}else{
			GL.y = Math.round( tagpro.renderer.canvas.height - 80 );
		}
	},
	handleGlobalListSprites : function(){
		var slotUse, GL, ST;

		// create container
		if( !Renderer.floaterLayer.globalList ){
			Renderer.floaterLayer.globalList = Renderer.globalSprite();
		}

		GL = Renderer.floaterLayer.globalList;

		// create poss timer slots
		slotUse = Math.min( Config.maxPupDetailedTracking , Database.globalCounts[0] );

		ST = GL.poss;

		while( slotUse > ST.V_slots ){
			ST[ 's_' + ST.V_slots ] = tagpro.renderer.prettyText('', '#ffffff');
			ST.addChild( ST[ 's_' + ST.V_slots ] );
			ST[ 's_' + ST.V_slots ].position.x = ST.V_slots * 20;

			ST[ 's_' + ST.V_slots ].V_text = '';
			ST[ 's_' + ST.V_slots ].V_color = '#ffffff';

			ST.V_slots++;
		}

		// create nill timer slots
		slotUse = Math.min( Config.maxPupDetailedTracking , Database.globalCounts[1] );

		ST = GL.nill;

		while( slotUse > ST.V_slots ){
			ST[ 's_' + ST.V_slots ] = tagpro.renderer.prettyText('', '#ffcc99');
			ST.addChild( ST[ 's_' + ST.V_slots ] );
			ST[ 's_' + ST.V_slots ].position.x = ST.V_slots * 20;

			ST[ 's_' + ST.V_slots ].V_text = '';
			ST[ 's_' + ST.V_slots ].V_color = '#ffcc99';

			ST.V_slots++;
		}
	},


	updateAllPlayers : function(){
		var id;

		// loop through all players
		for(id in tagpro.players){
			Logic.updatePlayer( tagpro.players[id] );
		}
	},
	updatePlayer : function(player){
		// update player state
		Logic.statePlayer( player );
		// update player graphics
		Logic.graphicsPlayer( player );
	},

	statePlayer : function(player){
		// update all database timers for player
		Logic.updateAllPlayerTimers( player );
	},
	graphicsPlayer : function(player){
		// create sprites for player timers
		Logic.handlePlayerSprites( player );

		// create sprite for player pup count
		Logic.createCountSprite( player );

		// set text of timer slots
		Renderer.setTextPlayerSlots( player );

		// set text of powerup count
		Renderer.setTextPlayerPupCount( player );
	},

	updateAllPlayerTimers : function(player){
		var i, pd = Database.player[ player.id ];

		// update all player timers
		for(i = 0; i < pd.timers.length; i++){
			if( !pd.timers.length ) break;

			// update timer
			Logic.updatePlayerTimer( pd.timers[i] );

			// remove expired timer
			if( Logic.removePlayerTimer( player.id , i ) ){
				i--; continue;
			}
		}
	},
	removePlayerTimer : function(id, index){
		var temp = Database.player[id].timers[index],
			player = tagpro.players[id];

		// timer is 0
		if( temp[1] === 0 ){
			Database.player[id].timers.splice( index , 1 );
			return true;
		}

		// visible and has no pups
		if( player.draw && !( player.bomb || player.tagpro || player.grip ) ){
			Database.player[id].timers.splice( index , 1 );
			return true;
		}

		return false;
	},

	updatePlayerTimer : function(timer){
		timer[1] = Math.max( 0 , 20000 - Helper.getTimeSince( timer[0] ) );
	},

	handlePlayerSprites : function(player){
		var slotUse = Math.min( 8 , Database.player[ player.id ].timers.length ), AP;

		// create container
		if( !player.sprites.activePups ){
			player.sprites.activePups = Renderer.slotSprite();
			player.sprites.activePups.position.x = -25;

			player.sprites.info.addChild( player.sprites.activePups );
		}

		AP = player.sprites.activePups;

		// create timer slots
		while( slotUse > AP.V_slots ){
			AP[ 's_' + AP.V_slots ] = tagpro.renderer.prettyText('', '#ffffff');
			AP.addChild( AP[ 's_' + AP.V_slots ] );
			AP[ 's_' + AP.V_slots ].position.y = AP.V_slots * 10;
			AP[ 's_' + AP.V_slots ].V_text = '';

			AP.V_slots++;
		}
	},
	createCountSprite : function(player){
		var AP;

		if( !Config.showPlayerPupCount || !player.sprites.activePups ) return;

		AP = player.sprites.activePups;

		// create counter
		if( !AP.counter ){
			AP.counter = tagpro.renderer.prettyText('', '#ffff00');
			AP.addChild( AP.counter );
			AP.counter.position.x = 30;
			AP.counter.position.y = 0;
			AP.counter.V_text = '';
		}
	}
};

var Database = {
	// legacy renderer
	legacyRender : false,

	// gamestate   0-init, 1-map, 2-ticking, 3-pregame, 4-ingame, 5-postgame
	state : 0,

	// joined before game start
	preGame : false,

	// countdown to
	endTime : 0,

	// pup count
	pupCount : 0,

	// queued socket events
	socketQueue : [],

	// timer locations
	locate : {},

	// list of timers
	tiles : [],

	// list of pup timers
	pupTiles : [],

	// list of temporary timers
	temp : [],

	// queued global updates
	globalQueue : [],

	// list of global timers
	global : [],

	// count global poss and nill
	globalCounts : [ 0 , 0 ],

	// player pup data
	player : {},

	// player position
	position : {x: 0, y: 0},



	// time for each object
	timeTable : {
		pup : 60000,
		bomb : 30000,
		boost : 10000,
	},



	// color for each object
	colorTable : {
		// - player spawn
		redball : 0xcc6600,
		blueball : 0x0066cc,

		// - tiles
		boost : 0xffff00,
		boostred : 0xff0000,
		boostblue : 0x0000ff,
		powerup : 0x00ff00,
		bomb : 0x3f3f3f,
		portal : 0x7f00ff,

		// - warning border
		warnborder : 0x333333,
	},



	createPOIEntry : function(x, y, prop, data){
		var POI = {
			// position
			x: x, y: y,

			// sprites
			sprite: false, floater: false,

			// text
			timeLeftText: '', timeAtText: false,

			// properties
			fillColor: prop[2], type: prop[0], value: data,

			// timer
			timeStamp: false, timeMax: prop[1], timeLeft: 0,

			// state
			pupId: -1, updateNeeded: false,
			ready: Helper.isValueReady(data), active: false,

			// tracking
			live: false, liveSince: false, wasReadyOnLoad: false, changedSinceLive: false,
			known: false, progress: 0, priority: 0,
			liveReady: -1, switchedReady: false, switchedUnready: false,

			// warning
			lastWarnAt: false, inWarnState: false,

			// updates
			curr : { ts: 0, v: 0, k: false },
			prev : { ts: 0, v: 0, k: false },

			// debug
			debug : {
				timeStamp: false, timeMax: 5000, timeLeft: 0,
			},
		};

		// add POI to database
		if( !Database.locate[x] ) Database.locate[x] = {};
		Database.locate[x][y] = POI;
		Database.tiles.push( POI );

		if( POI.type == 'powerup' ){
			// set pupId and add to pupTiles
			POI.pupId = Database.pupCount + 0;
			Database.pupCount++;
			Database.pupTiles.push( POI );
		}

		return POI;
	},
	createTempEntry : function(prop, data){
		var temp = {
			color: 0xcc00cc,
			timeStamp : data.time || Date.now(),
			timeMax : prop.w || 3000,
			timeLeft : -1, text : '',
			sprite : false,
		};

		if( prop.t == 1 ) temp.color = Database.colorTable.redball;
		if( prop.t == 2 ) temp.color = Database.colorTable.blueball;

		temp.sprite = Renderer.tempSprite();

		temp.sprite.position.x = prop.x;
		temp.sprite.position.y = prop.y;

		// add temp to database
		Database.temp.push( temp );

		return temp;
	},
	createPlayerData : function(id){
		if( Database.player[id] ) return;

		var player = {
			init: Date.now(), ready: false,
			pups: 0, timers : []
		};

		Database.player[id] = player;
	}
};

var Renderer = {
	isReady : false,

	// layers for graphics
	timerLayer : false, floaterLayer : false,



	// - main sprite types
	timerSprite : function(POI){
		var base = Helper.getPixiContainer();
		base.position.x = POI.x * 40; base.position.y = POI.y * 40;

		// progress circle
		base.circle = Renderer.circleSprite();
		base.addChild( base.circle );

		// large text
		base.largeText = Renderer.largeTextSprite( true );
		base.addChild( base.largeText );

		// small text
		base.smallText = Renderer.smallTextSprite( true );
		base.addChild( base.smallText );

		Renderer.timerLayer.addChild( base );

		return base;
	},
	floaterSprite : function(){
		var base = Helper.getPixiContainer();

		base.V_scale = 1;
		base.V_visible = true;

		// large text
		base.largeText = Renderer.largeTextSprite();
		base.addChild( base.largeText );

		// small text
		base.smallText = Renderer.smallTextSprite();
		base.addChild( base.smallText );

		Renderer.floaterLayer.addChild( base );

		return base;
	},
	tempSprite : function(){
		var base = Helper.getPixiContainer();

		// progress circle
		base.circle = Renderer.circleSprite();
		base.addChild( base.circle );

		// large text
		base.largeText = Renderer.largeTextSprite( true );
		base.addChild( base.largeText );

		Renderer.timerLayer.addChild( base );

		return base;
	},
	globalSprite : function(){
		var base = Helper.getPixiContainer();

		base.V_visible = true;

		// poss timers
		base.poss = Renderer.slotSprite();
		base.addChild( base.poss );

		// nill timers
		base.nill = Renderer.slotSprite();
		base.nill.position.y = 10;
		base.addChild( base.nill );

		Renderer.floaterLayer.addChild( base );

		return base;
	},



	// - subsprites
	slotSprite : function(){
		var base = Helper.getPixiContainer();

		base.V_slots = 0;

		return base;
	},
	circleSprite : function(){
		var base = new PIXI.Graphics();

		base.x = 20; base.y = 20;
		base.alpha = 0.75;

		base.V_radius = 0;
		base.V_state = true;

		return base;
	},
	borderSprite : function(){
		var base = new PIXI.Graphics();

		base.x = 20; base.y = 20;
		base.alpha = 0.75;

		base.V_drawn = false;
		base.V_visible = true;

		return base;
	},
	largeTextSprite : function(val){
		var base;

		if( Database.legacyRender ){
			base = new PIXI.Text('',{font: 'bold 16pt Arial', fill: 'black', stroke: 'white', strokeThickness: 5});
		}else{
			base = new PIXI.Text('',{fontFamily: 'Arial', fontSize: '16pt', fontWeight: 'bold', fill: 'black', stroke: 'white', strokeThickness: 5});
		}

		base.x = 20; base.y = 20;

		if( Database.legacyRender ){
			base.anchor.x = 0.45; base.anchor.y = 0.45;
		}else{
			base.anchor.x = 0.5; base.anchor.y = 0.5;
		}

		base.alpha = 0.75;

		if( val ){
			base.V_text = '';
			base.V_color = 'black';
		}

		return base;
	},
	smallTextSprite : function(val){
		var base;

		if( Database.legacyRender ){
			base = new PIXI.Text('',{font: 'bold 12pt Arial', fill: '#ffff66', stroke: 'black', strokeThickness: 3});
		}else{
			base = new PIXI.Text('',{fontFamily: 'Arial', fontSize: '12pt', fontWeight: 'bold', fill: '#ffff66', stroke: 'black', strokeThickness: 3});
		}

		base.x = 20; base.y = 40;

		if( Database.legacyRender ){
			base.anchor.x = 0.45; base.anchor.y = 0.45;
		}else{
			base.anchor.x = 0.5; base.anchor.y = 0.5;
		}

		base.alpha = 0.75;

		if( val ){
			base.V_text = '';
			base.V_yPos = 40;
		}

		return base;
	},



	updateDebug : function(POI){
		Renderer.setDebugBorder( POI );
	},

	updateText : function(POI){
		Renderer.setText( POI );
		Renderer.setTextColor( POI );
		Renderer.setTextPosition( POI );
	},
	updateCircle : function(POI){
		Renderer.setCircleGraphics( POI );
	},
	updateFloater : function(POI){
		if( !( POI.floater && POI.floater.visible ) ) return;

		Renderer.setFloaterScale( POI );
		Renderer.setFloaterPosition( POI );
	},

	setText : function(POI){
		var largeText, smallText, timeLeft, timeAt, dispAt;

		timeLeft = POI.timeLeftText;
		timeAt = POI.timeAtText;

		if( !( POI.timeMax >= 20000 || Config.alwaysAt ) ) timeAt = '';

		// get text based on tileDisplay
		switch( Config.tileDisplay ){
			case 0 : {
				largeText = timeLeft;
				smallText = timeAt;

				break;
			}
			case 1 : {
				largeText = timeLeft;
				smallText = '';

				break;
			}
			case 2 : {
				largeText = timeAt;
				smallText = timeLeft;

				break;
			}
			case 3 : {
				largeText = timeAt;
				smallText = '';

				break;
			}
			case 4 : {
				if( POI.timeLeft > 10000 ){
					largeText = timeAt;
					smallText = timeLeft;
				}else{
					largeText = timeLeft;
					smallText = timeAt;
				}

				break;
			}
			case 5 : {
				if( POI.timeLeft > 10000 ){
					largeText = timeAt;
					smallText = '';
				}else{
					largeText = timeLeft;
					smallText = timeAt;
				}

				break;
			}
			case 6 : {
				if( POI.timeLeft > 10000 ){
					largeText = timeAt;
					smallText = '';
				}else{
					largeText = timeLeft;
					smallText = '';
				}

				break;
			}
			default : {
				largeText = timeLeft;
				smallText = timeAt;
			}
		}

		// set large text
		Helper.setValue( POI.sprite.largeText , 'V_text' , largeText , function(){
			if( Database.legacyRender ){
				POI.sprite.largeText.setText( largeText );
				if( POI.floater ) POI.floater.largeText.setText( largeText );
			}else{
				POI.sprite.largeText.text = largeText;
				if( POI.floater ) POI.floater.largeText.text = largeText;
			}
		});
		// set small text
		Helper.setValue( POI.sprite.smallText , 'V_text' , smallText , function(){
			if( Database.legacyRender ){
				POI.sprite.smallText.setText( smallText );
				if( POI.floater ) POI.floater.smallText.setText( smallText );
			}else{
				POI.sprite.smallText.text = smallText;
				if( POI.floater ) POI.floater.smallText.text = smallText;
			}
		});
	},
	setTextColor : function(POI){
		var color = POI.known ? 'black' : 'brown';

		Helper.setValue( POI.sprite.largeText , 'V_color' , color , function(){
			POI.sprite.largeText.style.fill = color;
			if( POI.floater ) POI.floater.largeText.style.fill = color;
		});
	},
	setTextPosition : function(POI){
		var yPos = Helper.tileNearBottom(POI.y) ? 0 : 40;

		Helper.setValue( POI.sprite.smallText , 'V_yPos' , yPos , function(){
			POI.sprite.smallText.y = yPos;
			if( POI.floater ) POI.floater.smallText.y = yPos;
		});
	},

	setCircleGraphics : function(POI){
		var circle = POI.sprite.circle;

		var state, radius;

		if( !POI.timeMax ) return;

		// get state
		if( POI.inWarnState ){
			if( Config.warningType === 0 ){
				state = 'fill';
			}else if( Config.warningType === 1 ){
				state = 'stroke';
			}else{
				state = 'hidden';
			}
		}else{
			if( POI.known ){
				state = 'fill';
			}else{
				state = 'hidden';
			}
		}

		if( POI.timeLeft === 0 ) state = 'hidden';

		// set state
		Helper.setValue( POI.sprite.circle , 'V_state' , state , function(){
			if( state == 'hidden' ){
				circle.visible = false;
			}else{
				circle.V_radius = 0;
				circle.visible = true;
			}
		});

		if( !( state == 'stroke' || state == 'fill' ) ) state = 'hidden';

		if( state == 'hidden' ) return;

		// get radius
		radius = POI.type == 'portal' ? 15 : 13;
		if( state == 'fill' ) radius *= Math.min( 1 , 1 - ( POI.timeLeft - POI.timeMax * 0.1 ) / POI.timeMax );
		radius = 2 + radius;

		// redraw if radius difference is 0.25
		Helper.setValueDelta( POI.sprite.circle , 'V_radius' , radius , 0.25 , function(){
			if( state == 'fill' ){
				circle.clear().beginFill( POI.fillColor ).drawCircle( 0 , 0 , radius ).endFill();
			}else{
				circle.clear().lineStyle( 2 , Database.colorTable.warnborder ).drawCircle( 0 , 0 , radius - 1 );
			}
		});
	},

	setFloaterScale : function(POI){
		Helper.setValue( POI.floater , 'V_scale', 1 / tagpro.zoom , function(){
			POI.floater.scale.x = POI.floater.scale.y = 1 / tagpro.zoom;
		});
	},
	setFloaterPosition : function(POI){
		var player = Database.position;

		POI.floater.position.x = Math.max( 0 , Math.min( tagpro.renderer.canvas.width - 40 * POI.floater.V_scale ,
			( tagpro.renderer.canvas.width / 2 ) + ( ( POI.x * 40 - player.x * 40 - 20 ) / tagpro.zoom )
		));
		POI.floater.position.y = Math.max( 0 , Math.min( tagpro.renderer.canvas.height - 40 * POI.floater.V_scale ,
			( tagpro.renderer.canvas.height / 2 ) + ( ( POI.y * 40 - player.y * 40 - 20 ) / tagpro.zoom )
		));
	},

	setDebugBorder : function(POI){
		var border, visible;

		// create border sprite
		if( !POI.sprite.border ){
			POI.sprite.border = Renderer.borderSprite();
			POI.sprite.addChild( POI.sprite.border );
		}

		border = POI.sprite.border;

		// get visibility
		visible = !!(POI.debug.timeStamp);

		// set visibility
		Helper.setValue( POI.sprite.border , 'V_visible' , visible , function(){
			border.visible = visible;
		});

		if( !visible ) return;

		// draw border
		Helper.setValue( POI.sprite.border , 'V_drawn' , true , function(){
			border.clear().lineStyle( 4 , 0xff00ff ).drawRect( -20 , -20 , 40 , 40 );
		});
	},



	updateTempText : function(temp){
		Renderer.setTempText( temp );
	},
	updateTempCircle : function(temp){
		Renderer.setTempCircleRadius( temp );
	},

	setTempText : function(temp){
		Helper.setValue( temp.sprite.largeText , 'V_text' , temp.text , function(){
			if( Database.legacyRender ){
				temp.sprite.largeText.setText( temp.text );
			}else{
				temp.sprite.largeText.text = temp.text;
			}
		});
	},
	setTempCircleRadius : function(temp){
		var circle = temp.sprite.circle, radius = 2;

		radius += 17 * Math.min( 1 , 1 - ( temp.timeLeft - temp.timeMax * 0.1 ) / temp.timeMax );

		// redraw if radius difference is 0.25
		Helper.setValueDelta( temp.sprite.circle , 'V_radius' , radius , 0.25 , function(){
			circle.clear().beginFill( temp.color ).drawCircle( 0 , 0 , radius ).endFill();
		});
	},

	setGlobalText : function(){
		var poss = [], nill = [];
		var i, count, GL, sprite, text, color;

		GL = Renderer.floaterLayer.globalList;

		// populate timer lists
		i = 0; count = Database.global.length;

		while( i < count ){
			if( Database.global[i][2].length > 0 ){
				poss.push( Database.global[i] );
			}else{
				nill.push( Database.global[i] );
			}

			i++;
		}

		// set poss
		i = 0; count = GL.poss.V_slots;

		while( i < count ){
			sprite = GL.poss[ 's_' + i ];

			if( i < poss.length ){
				text = Helper.getTimeLeftText( poss[i][1] );

				if( poss[i][1] < 40000 || poss[i][3] === false || !tagpro.players[ poss[i][3] ] ){
					color = '#ffffff';
				}else{
					if( tagpro.players[ poss[i][3] ].team === 1 ){
						color = '#ffcccc';
					}else if( tagpro.players[ poss[i][3] ].team == 2 ){
						color = '#ccccff';
					}else{
						color = '#ffffff';
					}
				}
			}else{
				text = '';
			}

			// set text
			Helper.setValue( sprite , 'V_text' , text , function(){
				if( Database.legacyRender ){
					sprite.setText( text );
				}else{
					sprite.text = text;
				}
			});

			// set color
			Helper.setValue( sprite , 'V_color' , color , function(){
				sprite.style.fill = color;
			});

			i++;
		}

		// set nill
		i = 0; count = GL.nill.V_slots;

		while( i < count ){
			sprite = GL.nill[ 's_' + i ];

			if( i < nill.length ){
				text = Helper.getTimeLeftText( nill[i][1] );

				if( nill[i][1] < 40000 || nill[i][3] === false || !tagpro.players[ nill[i][3] ] ){
					color = '#cccccc';
				}else{
					if( tagpro.players[ nill[i][3] ].team === 1 ){
						color = '#cc9999';
					}else if( tagpro.players[ nill[i][3] ].team == 2 ){
						color = '#9999cc';
					}else{
						color = '#cccccc';
					}
				}
			}else{
				text = '';
			}

			// set text
			Helper.setValue( sprite , 'V_text' , text , function(){
				if( Database.legacyRender ){
					sprite.setText( text );
				}else{
					sprite.text = text;
				}
			});

			// set color
			Helper.setValue( sprite , 'V_color' , color , function(){
				sprite.style.fill = color;
			});

			i++;
		}
	},
	setTextPlayerSlots : function(player){
		var i, count, text, db;

		// player is drawable
		if ( !( player.draw && !player.dead ) ) return;

		i = 0; count = player.sprites.activePups.V_slots;
		db = Database.player[ player.id ];

		while( i < count ){
			// get text of timers
			if( i < db.timers.length ){
				// has timer set text
				text = Helper.getTimeLeftText( db.timers[i][1] );
			}else{
				// no timer
				text = '';
			}

			// config disables activePups
			if( !Config.showPlayerTimers ) text = '';

			Helper.setValue( player.sprites.activePups[ 's_' + i ] , 'V_text' , text , function(){
				if( Database.legacyRender ){
					player.sprites.activePups[ 's_' + i ].setText( text );
				}else{
					player.sprites.activePups[ 's_' + i ].text = text;
				}
			});

			i++;
		}
	},
	setTextPlayerPupCount : function(player){
		var db, text;

		// player is drawable
		if ( !( player.draw && !player.dead ) ) return;

		// has sprite to draw to
		if( !player.sprites.activePups || !player.sprites.activePups.counter ) return;

		db = Database.player[ player.id ];

		text = '' + db.pups;

		// hide on spectate
		if( Config.hideCountSpectate && tagpro.spectator ) text = '';

		Helper.setValue( player.sprites.activePups.counter , 'V_text' , text , function(){
			if( Database.legacyRender ){
				player.sprites.activePups.counter.setText( text );
			}else{
				player.sprites.activePups.counter.text = text;
			}
		});
	}
};

tagpro.ready(function(){

	// legacy renderer
	if( !PIXI.Container ) Database.legacyRender = true;

	// read map data
	var getMapData = setInterval(function(){

		if( tagpro.map ){
			Logic.readMapData( tagpro.map );
			console.log( 'TSHSU - map data loaded');
			clearInterval( getMapData );
		}

	}, 50);



	// socket handler
	var socketListener = function(socket, handler){
		tagpro.socket.on(socket, function(data){
			var ts = Date.now();
			try{ handler( ts, data ); }
			catch(error){ console.log( 'Socket IO Error', error , data ); }
		});
	};



	// socket listeners
	socketListener('mapupdate', function(ts, data){
		if(!(data instanceof Array)) data = [data];

		var pos = tagpro.players[ tagpro.playerId ];
		pos = { x : pos.x / 40 , y : pos.y / 40 };

		Logic.readSocketMessage( { type : 'mapupdate', time : ts, pos : pos, data : data } );
	});

	socketListener('spawn', function(ts, data){
		data.w = parseFloat(data.w);
        data.x = parseInt(data.x);
        data.y = parseInt(data.y);

        Logic.readSocketMessage( { type : 'spawn', time : ts, data : data } );
    });

	socketListener('end', function(ts, data){
        Logic.readSocketMessage( { type : 'end', time : ts, data : data } );
    });

	socketListener('p', function(ts, data){
		if( !data.t ) data = { t: 0, u: data };

		Logic.readSocketMessage( { type : 'p', time : ts, data : data } );
	});



	// render hook
	var preInitUpdate = setInterval(function(){

		// map is loaded and renderer ready
		if( Database.state !== 0 && tagpro.renderer.updateGraphics ){
			renderHook(); return;
		}

		Logic.tick();

	}, 50);

	var renderHook = function(){
		var OLD_RENDER = tagpro.renderer.updateGraphics;

		// override render function to include update
		tagpro.renderer.updateGraphics = function(){
			// call tagpro render code
			OLD_RENDER();

			// call script update code
			Logic.tick();
		};

		clearInterval(preInitUpdate);
		console.log( 'TSHSU - render hook established' );
	};


	// debug
	if( false ){

	tagpro.tilmer = {
		config : Config,
		helper : Helper,
		logic : Logic,
		database : Database,
		renderer : Renderer
	};

	}

});