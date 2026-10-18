<?php
@session_start();
$con = mysqli_connect("localhost", "root", "", "my_andreaaca");
if (mysqli_connect_errno()) printf("Connect failed: %s\n", mysqli_connect_error());
$record = mysqli_query($con, "SELECT name, record, flag FROM `record` ORDER BY record DESC LIMIT 10");
//$record = mysqli_fetch_assoc($record);
$record = mysqli_fetch_all($record,MYSQLI_ASSOC);
$html = '<table><thead>
    <tr>
      <th>Name</th>
      <th class="w-80">Flag</th>
      <th>Record</th>
    </tr>
</thead>';
foreach ($record as $k => $v) {
    $html .= '<tr><th>' . $v['name'] . '</th><th>' . $v['flag'] . '</th><th>' . $v['record'] . '</th>';
}
$html .= '</table>';
mysqli_close($con);
?>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>World jumping - Game free - Best platform 3D online</title>
        <link rel="stylesheet" type="text/css" href="/platform3D-classic/style.css?v=2">
        <link rel="stylesheet" type="text/css" href="/css/resource.css?v=10">

        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <meta name="keywords" content="game, online, free, platform, gratis, giochi, best, 2018">
        <meta name="description" content="World jumping - Play for free the new 3D platform game; Unlock levels, challenge your friends and try to break the world record!">
        <meta name="author" content="Designed by Andrea Acanfora">
        <meta name="language" content="en">

        <meta property="og:type" content="website">
        <meta property="og:locale" content="it_IT">
        <meta property="og:site_name" content="World jumping">
        <meta property="og:url" content="https://andreaaca.altervista.org/world-jumping-game-online-free">
        <meta property="og:image" content="https://andreaaca.altervista.org/img/platform.jpg?v=1">
        <meta property="og:title" content="World jumping - Best game online free platform 3D">
        <meta property="og:description" content="Play for free the new 3D platform game; Challenge your friends, try to break the world record!">
        
        <meta name="twitter:card" content="summary">
        <meta name="twitter:creator" content="Andrea Acanfora">
        <meta name="twitter:site" content="https://andreaaca.altervista.org/world-jumping-game-online-free">
        <meta name="twitter:image" content="https://andreaaca.altervista.org/img/platform.jpg?v=1">
        <meta name="twitter:title" content="World jumping - Best game online free platform 3D">
        <meta name="twitter:description" content="Play for free the new 3D platform game; Challenge your friends, try to break the world record!">
    </head>
    <body id="body">
        <script src="/three.js/build/three.min.js"></script>
        <script src="/three.js/examples/js/controls/PointerLockControls.js"></script>
        <script type="text/javascript" src="/platform3D-classic/game.js?v=<?=rand()?>"></script> 
        <script>
            var audio;
            var newGame = function(m){
                var nameObj = document.getElementById("name");
                if ( nameObj.value.length <= 2 ){
                    alert('Please insert name!');
                } else {
                    localStorage.setItem('name', nameObj.value);
                    if ( localStorage.getItem('audio') == 'true' ){
                    	document.getElementById("source").src = '/audio/'+m+'.mp3';
	                    audio = document.getElementById("audio");
	                    audio.load();
                    }
                    game(m,audio);
                }
            }
        </script>   
        <div class="fixed w100 h100 t0 l0 z8 bc-0" id="overlay">
            <p class="c-f pl-20">
                Capture <script>document.write((parseInt(localStorage.getItem('level'))+1)||1)</script> flag in the new level for unlock
            </p>
            <div class="mt-30">
                <div class="h-40 lh40 w100 mb-10 c-f">
                    <div class="w-200 left pl-20 f-22">
                        Choose map
                    </div>
                    <input type="text" name="name" id="name" class="w-150 h-40 brd-1 brd-c-c left transparent c-f ti10" placeholder="Name">
                    <div class="left ml-20">
                        Difficult:
                    </div>
                    <select class="w-150 left ml-20 brd-1 brd-c-c h-40 transparent c-f" name="difficult" id="difficult">
                        <option value="1" class="c-3">Easy</option>
                        <option value="2" class="c-3" selected>Normal</option>
                        <option value="3" class="c-3">Hard</option>
                    </select>
                    <div class="left ml-20">
                        Audio:
                    </div>
                    <input type="checkbox" name="checkbox" id="ckAudio" class="w-40 h-40 mt-0 ml-10" onchange="localStorage.setItem('audio',this.checked);">
                </div>
                <div class="left ml-20 relative lv">
                    <img src="/img/1.jpg?v=1" alt="World jumping - Best game online free platform 3D" class="cursor brd-1 brd-c-f" onclick="newGame(1)">
                </div>
                <?php for ($i=2; $i <= 12; $i++) { ?>
                    <div class="left ml-20 relative lv">
                        <img src="/img/<?=$i?>.jpg?v=1" alt="World jumping - Best game online free platform 3D" class="brd-1 brd-c-f unlock">
                        <p class="absolute t-20 c-f w100 tc">LOCK</p>
                    </div>
                <?php } ?>
            </div>
            <div class="absolute c-f tr b-20 r-20">
                <a href="/world-jumping-game-online-free" title="Guide" class="notd">guide</a>
            </div>
        </div>  
        <div class="absolute l-20 t-30">
            <div class="f-40">
                Points: <span id="point">0</span>
            </div>
            <div class="f-20 mt-5">
                Power jump: <span id="power"></span>
            </div>
            <div class="f-20 mt-5">
                Magic cap: <span id="magic">0</span>
            </div>
            <div class="f-20 mt-5">
                Speed: <span id="speed"></span>
            </div>
            <div class="f-20 mt-5">
                Flag: <span id="flag">0</span>
            </div>
            <div class="f-20 mt-5">
                Fuel: <span id="fuel">0</span>
            </div>
        </div>
        <div class="absolute r-20 t-30 tr f-40">
            Life: <span id="life"></span>
        </div>
        
        <div id="msg"></div>
        <div class="absolute f-14 b-20 r-30"><?=$html?></div>
        <div id="author">Powered by Andrea Acanfora <a href="https://www.paypal.me/AndreaAca" target="_blank" title="donate"><img src="/platform3D-classic/donate.png" alt="donate" height="30"></a></div>
        <div id="blocker">  
        	<a id="newGame" href="">New game</a>
            <div id="instructions">
                <span class="f-40">Click to start</span>
                <br>
                (W, A, S, D: move, SPACE: jump, MOUSE: rotation screen, F: full screen, T: speed, P: jetpack, ESC = pause)<br>
            </div>
        </div>
        <audio id="audio" style="display: none;" loop>
          <source id="source" src="" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        <script>
        	var w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        	if ( w < 767 ){
        		document.getElementById('overlay').innerHTML = '<div class="f-26 mt-30 c-f tc">Sorry, is not avaiable for mobile</div>';
        	}
            var nameObj = document.getElementById("name");
            if ( localStorage.getItem('name') ){
                nameObj.value = localStorage.getItem('name');
            }

            if ( !localStorage.getItem('audio') || localStorage.getItem('audio') != 'false' ){
               document.getElementById('ckAudio').checked = 1;
            }

            var levels = document.getElementsByClassName('lv'),
                levelsL = levels.length,
                level  = parseInt(localStorage.getItem('level'));
            for (var i = 0; i < levelsL; i++) {
                if ( i <= level ){
                    levels[i].children[0].classList.remove("unlock");
                    levels[i].children[0].setAttribute( "onClick", "newGame("+(i+1)+")" );
                }
            }
        </script>
    </body>
</html>