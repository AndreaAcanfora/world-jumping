function game (map,audio) {
	document.getElementById('overlay').style.display = 'none';

	var THREEx		= THREEx 		|| {};
	THREEx.FullScreen	= THREEx.FullScreen	|| {};
	THREEx.FullScreen._hasWebkitFullScreen	= 'webkitCancelFullScreen' in document	? true : false;	
	THREEx.FullScreen._hasMozFullScreen	= 'mozCancelFullScreen' in document	? true : false;

	var camera, scene, renderer,
		geometry, material, mesh, raycaster,
		controls, animateFrame, flag, flag2,
		intersections, isOnObject, time, delta, controlsObj,
		difficult = document.getElementById('difficult').value,
		coefScore = (50 - ((3-difficult)*10) ),
		coefDelta = (difficult==1?80:100),
		maxSizePlatform = (difficult==3?150:250),
		minSizePlatform = (difficult==1?80:10),
		timeForScore    = (coefScore+10), 
		totalTime       = 0,
		life = (4-difficult), 
		dead = false,
		lifeObj    = document.getElementById("life"),
		speedObj   = document.getElementById("speed"),
		powerObj   = document.getElementById("power"),
		pointObj   = document.getElementById("point"),
		msgObj     = document.getElementById("msg"),
		flagObj    = document.getElementById("flag"),
		fuelObj    = document.getElementById("fuel"),
		magicObj   = document.getElementById("magic"),
		instructions = document.getElementById( 'instructions' ),
		changeWidth  = 120,
		changeHeight = 40,
		powerJump    = 140,
		fuel         = 150,
		flagCaptured = -1,
		objects      = [],
		speedStart   = (4-difficult),
		speed        = speedStart;
		magic        = 1;

	//bandiera
	geometry = new THREE.BoxGeometry( 10, 150, 10 );
	material = new THREE.MeshBasicMaterial( { color: 'black' } );
	flag = new THREE.Mesh( geometry, material );
	geometry = new THREE.BoxGeometry(60,3,20);
	material = new THREE.MeshBasicMaterial( { color: Math.random() * 0xffffff } );
	flag2 = new THREE.Mesh( geometry, material );

	lifeObj.innerHTML  = life;
	speedObj.innerHTML = speedStart;
	powerObj.innerHTML = powerJump+10;
	fuelObj.innerHTML  = fuel;
	magicObj.innerHTML = magic;

	blockerScreen();

	setInterval(function(){  
	  if(timeForScore > 0){
	  	timeForScore--;
	  }
	  totalTime++;
	},1000);

	init();

	animate();

	var controlsEnabled = false,
		moveForward  = false,
		jetpack      = false,
		moveBackward = false,
		moveLeft     = false,
		moveRight    = false,
		prevTime     = performance.now(),
		velocity     = new THREE.Vector3(),
		xx = 0, yy = 10, zz = 0, //  coordinate prossimo checkpoint
		xxSpown, yySpown , zzSpown, //ora coordinate iniziali poi checkpoint
		nPlatform = 10;

	function init() {

		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 100000 );

		scene = new THREE.Scene();

		controls = new THREE.PointerLockControls( camera );
		scene.add( controls.getObject() );
		
		var type = map,
			box = ['','cielo','night','canyon','darkskies','dragonvale','cloud','snow2','tropical','nebula','sky','bluefreeze','cottoncandy'];
		if(type != 1 && type != 7) document.getElementById("body").style.color = 'white';
		var percorso = '../three.js/examples/textures/cube/skybox/';
			scene.add( makeSkybox( [
					percorso + box[type] + '_rt.jpg?v=1',
					percorso + box[type] + '_lf.jpg?v=1',
					percorso + box[type] + '_up.jpg?v=1',
					percorso + box[type] + '_dn.jpg?v=1',
					percorso + box[type] + '_bk.jpg?v=1',
					percorso + box[type] + '_ft.jpg?v=1' 
				], 100000 ));

		var onKeyDown = function ( event ) {

			switch ( event.keyCode ) {

				case 38: // up
				case 87: // w
					moveForward = true;
					break;

				case 37: // left
				case 65: // a
					moveLeft = true; break;

				case 40: // down
				case 83: // s
					moveBackward = true;
					break;

				case 39: // right
				case 68: // d
					moveRight = true;
					break;

				case 84: //turbo letter t
					if(speed){
						velocity.z -= 5000;
						speed--;
						speedObj.innerHTML = speed;
					}				
					break;
				case 70:
					if(THREEx.FullScreen.available()){
						THREEx.FullScreen.activated();
						THREEx.FullScreen.request();
					}
					break;

				case 32: // space
					if ( canJump === true ) velocity.y += powerJump;
					canJump = false;
					break;
				case 80: // p
					if(fuel > 0 && velocity.y < 300 ){
						jetpack = true;
					}
					break;
				case 73: // i
					if ( magic ){
						magicAction();
						magic--;
						magicObj.innerHTML = magic;
					}
					break;
			}
		};

		var magicAction = function(){
			var geometry = new THREE.BoxGeometry( 80, 20, 80 );
			var texture    = THREE.ImageUtils.loadTexture( '../three.js/examples/textures/texture'+(Math.floor((Math.random() * 8) + 1))+'.jpg' );//crate.gif
			texture.anisotropy = renderer.getMaxAnisotropy();

			var material = new THREE.MeshBasicMaterial( { map: texture } );

			var platform = new THREE.Mesh( geometry, material );
			
			platform.position.set( controlsObj.position.x , (controlsObj.position.y - 100) , controlsObj.position.z);
			scene.add( platform );
			objects.push( platform );
		}

		var onKeyUp = function ( event ) {

			switch( event.keyCode ) {

				case 38: // up
				case 87: // w
					moveForward = false;
					break;

				case 37: // left
				case 65: // a
					moveLeft = false;
					break;

				case 40: // down
				case 83: // s
					moveBackward = false;
					break;

				case 39: // right
				case 68: // d
					moveRight = false;
					break;

				case 80:
					jetpack = false;
					break;
			}

		};

		document.addEventListener( 'keydown', onKeyDown, false );
		document.addEventListener( 'keyup', onKeyUp, false );

		raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );

		// floor
		

		//

		renderer = new THREE.WebGLRenderer();
		renderer.setClearColor( 0xffffff );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		document.body.appendChild( renderer.domElement );

		// object

		var geometry = new THREE.BoxGeometry( 200, 200, 200 );
				
		var texture    = THREE.ImageUtils.loadTexture( '../three.js/examples/textures/texture'+(Math.floor((Math.random() * 8) + 1))+'.jpg' );//crate.gif
		texture.anisotropy = renderer.getMaxAnisotropy();

		var material = new THREE.MeshBasicMaterial( { map: texture } );

		var start = new THREE.Mesh( geometry, material );
		start.position.set(0,-110,0);
		scene.add( start );
		objects.push( start );

		window.addEventListener( 'resize', onWindowResize, false );

	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	function generate(n_platform, varianceWidth, variaceHeight){
		if(n_platform != 10){
			timeForScore += coefScore;
			msgObj.innerHTML = 'Flag conquered !!!';
			msgObj.style.display = 'block'; 
			setTimeout(function(){ msgObj.style.display = 'none';  },2000);
		}
		xxSpown = xx;
		yySpown = n_platform == 10 ? yy : yy+40;
		zzSpown = zz; // cambio punto spown
		
		if ( powerJump <= 290 ){
			powerJump += 10;
		}
		powerObj.innerHTML = powerJump;
		for (var i = 0; i < n_platform; i++) {
			var xPlatform = Math.floor((Math.random() * maxSizePlatform) + minSizePlatform),
				yPlatform = Math.floor((Math.random() * maxSizePlatform) + minSizePlatform);
			var geometry = new THREE.BoxGeometry( xPlatform, 20, yPlatform );
				
			var texture    = THREE.ImageUtils.loadTexture( '../three.js/examples/textures/texture'+(Math.floor((Math.random() * 8) + 1))+'.jpg' );//crate.gif
			texture.anisotropy = renderer.getMaxAnisotropy();

			var material = new THREE.MeshBasicMaterial( { map: texture } );

			var platform = new THREE.Mesh( geometry, material );

			xx += Math.floor((Math.random() * 2) + 1) == 1 ? Math.floor((Math.random() * varianceWidth) + 100) : -Math.floor((Math.random() * varianceWidth) + 100);
			yy += i < 10 ? Math.floor((Math.random() * variaceHeight) + 20) : Math.floor((Math.random() * 2) + 1) == 1 ? Math.floor((Math.random() * variaceHeight) + 20) :
			-Math.floor((Math.random() * variaceHeight) + 1);
			zz += Math.floor((Math.random() * 2) + 1) == 1 ? Math.floor((Math.random() * varianceWidth) + 100) : -Math.floor((Math.random() * varianceWidth) + 100);
			platform.position.set( xx , yy , zz);
			//if( i % 10 == 0) animate2(platform,0.2,0);
			//if ( i % 5 == 0 && xPlatform > 150 && yPlatform > 150 ) animate3(platform,0,1);
			scene.add( platform );
			objects.push( platform );
			if ( objects.length > 100 ){
				scene.remove( objects[0] );
				objects.shift();
			}
		};
		//bandiera finale vittoria
		flag.position.set(xx,yy+80,zz);
		flag2.position.set(xx+30,yy+130,zz);
		flag2.rotation.x = 90 * Math.PI /180;
		if(n_platform == 10){
			scene.add( flag );
			scene.add( flag2 );
		}
	}

	function animate2(cube,angularSpeed,lastTime){
		var time = (new Date()).getTime();
		var timeDiff = time - lastTime;
		var angularChange = angularSpeed * timeDiff * 2 * Math.PI / 1000;
		cube.rotation.y += angularChange;
		lastTime = time;
		renderer.render(scene, camera);
		requestAnimationFrame(function(){
			animate2(cube,angularSpeed,lastTime);
		})
	}

	function animate3(cube,count,flag){
		count += flag == 1 ? 1 : -1;
		cube.position.x += flag == 1 ? 1 : -1;
		flag = count == 150 ? 0 : count == -150 ? 1 : flag;
		renderer.render(scene, camera);
		requestAnimationFrame(function(){
			animate3(cube,count,flag);
		})
	}

	function animate() {

		animateFrame = requestAnimationFrame( animate );

		if ( controlsEnabled && !dead ) {
			controlsObj = controls.getObject();
			raycaster.ray.origin.copy( controlsObj.position );
			raycaster.ray.origin.y -= 10;

			intersections = raycaster.intersectObjects( objects );

			isOnObject = intersections.length > 0;

			time = performance.now();
			delta = ( time - prevTime ) / 1000;

			velocity.x -= velocity.x * 10.0 * delta;
			velocity.z -= velocity.z * 10.0 * delta;

			if ( moveForward ) velocity.z -= 1200.0 * delta;
			if ( moveBackward ) velocity.z += 800.0 * delta;

			if ( moveLeft ) velocity.x -= 1200.0 * delta;
			if ( moveRight ) velocity.x += 800.0 * delta;

			if ( jetpack && fuel > 0 && velocity.y < 300 ){
				velocity.y += 5;
				fuelObj.innerHTML = --fuel;
			}

			if (isOnObject === true ) {
				velocity.y = Math.max( 0, velocity.y );

				canJump = true;
			} else if ( velocity.y > -500 ){
				velocity.y -= 3 * coefDelta * delta; // 100.0 = mass
			}

			controlsObj.translateX( velocity.x * delta );
			controlsObj.translateY( velocity.y * delta );
			controlsObj.translateZ( velocity.z * delta );

			if ( controlsObj.position.y < -1000 ) {
				speed = speedStart;
				speedObj.innerHTML = speedStart;
				life--;
				if(life < 0){
					life = 0;
					dead = true;
				}
				lifeObj.innerHTML = life;
				timeForScore = (nPlatform/5-2) * coefScore;

				controlsObj.position.set(xxSpown,yySpown,zzSpown);
				velocity.y = Math.max( 0, velocity.y );
			}

			if( controlsObj.position.y < yy+100 && controlsObj.position.y > yy-100){
				if( controlsObj.position.x < xx+100 && controlsObj.position.x > xx-100){
					if( controlsObj.position.z < zz+100 && controlsObj.position.z > zz-100){
						if(((nPlatform/5-2) * coefScore - timeForScore + (nPlatform/5-2) + 10 ) >= 0){
							var point = parseInt(pointObj.innerHTML) + (timeForScore + (nPlatform/5-2)) + (life*2);
							pointObj.innerHTML = point;
						}
						flagCaptured++;
						flagObj.innerHTML = flagCaptured;
						var level = localStorage.getItem("level");
						if ( !level || ( level < flagCaptured && flagCaptured == map ) ){
							localStorage.setItem('level', flagCaptured);
						}
						generate(nPlatform, changeWidth, changeHeight);  // genera nuovo livello appena arrivi alla bandiera
						changeHeight+= 10;
						changeWidth += 20;
						nPlatform += 5;
					}
				}
			}

			prevTime = time;

		}else if(dead){
			document.getElementById( 'blocker' ).style.display = 'block';
			audio.pause();
			instructions.innerHTML = '';
			msgObj.innerHTML = 'You are dead !';
			msgObj.style.display = 'block';
            var text = document.getElementById( 'newGame' );
            text.style.display = 'block';
     		sendRecord();
            cancelAnimationFrame(animateFrame);
		}

		renderer.render( scene, camera );
	}

	function sendRecord() {
        var name = localStorage.getItem('name'),
            flag = parseInt(document.getElementById("flag").innerHTML);
            xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                console.log( 'success' );
            }
        };
        xhttp.open("POST", "newRecord.php", true);
        xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhttp.send("record="+(parseInt(pointObj.innerHTML))+'&name='+name+'&flag='+flag+'&time='+totalTime);
    }

	function makeSkybox( urls, size ) {
		var skyboxCubemap = THREE.ImageUtils.loadTextureCube( urls );
		skyboxCubemap.format = THREE.RGBFormat;

		var skyboxShader = THREE.ShaderLib['cube'];
		skyboxShader.uniforms['tCube'].value = skyboxCubemap;

		return new THREE.Mesh(
			new THREE.BoxGeometry( size, size, size ),
			new THREE.ShaderMaterial({
				fragmentShader : skyboxShader.fragmentShader, vertexShader : skyboxShader.vertexShader,
				uniforms : skyboxShader.uniforms, depthWrite : false, side : THREE.BackSide
			})
		);
	};

	function blockerScreen(){
		var blocker = document.getElementById( 'blocker' );
		var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

		if ( havePointerLock ) {

			var element = document.body;
			var pointerlockchange = function ( event ) {

				if ( document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element ) {

					controlsEnabled = true;
					controls.enabled = true;
					blocker.style.display = 'none';
					if ( audio ){
						audio.play();
					}
				} else {

					controls.enabled = false;
					blocker.style.display = '-webkit-box';
					blocker.style.display = '-moz-box';
					blocker.style.display = 'box';
					if ( audio ){
						audio.pause();
					}
					instructions.style.display = '';
				}
			}

			var pointerlockerror = function ( event ) {
				instructions.style.display = '';
			}

			// Hook pointer lock state change events
			document.addEventListener( 'pointerlockchange', pointerlockchange, false );
			document.addEventListener( 'mozpointerlockchange', pointerlockchange, false );
			document.addEventListener( 'webkitpointerlockchange', pointerlockchange, false );

			document.addEventListener( 'pointerlockerror', pointerlockerror, false );
			document.addEventListener( 'mozpointerlockerror', pointerlockerror, false );
			document.addEventListener( 'webkitpointerlockerror', pointerlockerror, false );

			instructions.addEventListener( 'click', function ( event ) {

				instructions.style.display = 'none';

				// Ask the browser to lock the pointer
				element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

				if ( /Firefox/i.test( navigator.userAgent ) ) {

					var fullscreenchange = function ( event ) {

						if ( document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element ) {

							document.removeEventListener( 'fullscreenchange', fullscreenchange );
							document.removeEventListener( 'mozfullscreenchange', fullscreenchange );

							element.requestPointerLock();
						}
					}

					document.addEventListener( 'fullscreenchange', fullscreenchange, false );
					document.addEventListener( 'mozfullscreenchange', fullscreenchange, false );

					element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;
					element.requestFullscreen();

				} else {
					element.requestPointerLock();
				}
			}, false );
		} else {
			instructions.innerHTML = 'Il tuo browser non supporta questa API';
		}
	}
	/**
	 * test if it is possible to have fullscreen
	 * 
	 * @returns {Boolean} true if fullscreen API is available, false otherwise
	*/
	THREEx.FullScreen.available	= function()
	{
		return this._hasWebkitFullScreen || this._hasMozFullScreen;
	}

	/**
	 * test if fullscreen is currently activated
	 * 
	 * @returns {Boolean} true if fullscreen is currently activated, false otherwise
	*/
	THREEx.FullScreen.activated	= function()
	{
		if( this._hasWebkitFullScreen ){
			return document.webkitIsFullScreen;
		}else if( this._hasMozFullScreen ){
			return document.mozFullScreen;
		}else{
			console.assert(false);
		}
	}

	/**
	 * Request fullscreen on a given element
	 * @param {DomElement} element to make fullscreen. optional. default to document.body
	*/
	THREEx.FullScreen.request	= function(element)
	{
		element	= element	|| document.body;
		if( this._hasWebkitFullScreen ){
			element.webkitRequestFullScreen();
		}else if( this._hasMozFullScreen ){
			element.mozRequestFullScreen();
		}else{
			console.assert(false);
		}
	}
}