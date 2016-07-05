	var metronome = true;
	var measures = 1;
	
	var GUI_measures  =null;
	var GUI_metronome  =null;
	var GUI_tempo =null;
	var GUI_timeSignature = null;
	var GUI_ticksInBeat = null;
	var GUI_currentTime	= null;
	var GUI_currentTick	= null;
	var GUI_currentBeatSubdivision = null;
	var GUI_currentBeatInBar = null;
	var GUI_currentBar	= null;

	var GUI_ticksContainer = null;
	var GUI_scheduledTicksContainer = null;
	
	var high= 2000;
	var low= 1000;

	var beatPattern = {1:low};
	var barPattern = {1:high};
	
	var commonTimeSignatures = ["2/4","3/4","4/4","6/8","9/8","12/8"];
	
	// initialize musicalClock
	var MyAudioContext = new AudioContext();
	musicalClock.audioContext = MyAudioContext;

	musicalClock.setTimeSignature("4/4");  		// 3 beats per bar, 24 ticks per beat (semiquaver)
	musicalClock.setBeatResolutionLevel(2);
	musicalClock.setTempo(140);

	// *** assign callbacks
	// single tick listeners
	musicalClock.onTick.sync = playBeep;		// realtime Callback
	musicalClock.onTick.async = updateGUI;		// unbloking low precision callback
	
	
	musicalClock.onScheduledTick.sync = function(nextTickStartTime){
		newTone(1.0, 500,nextTickStartTime);
		//console.log("sheduled " + musicalClock.getCurrentTick())
	}
	
	window.onload = function(){
		GUI_measures				= document.getElementById('measures');
		GUI_metronome				= document.getElementById('metronome');
		GUI_tempo 					= document.getElementById('tempo');
		GUI_timeSignature 			= document.getElementById('timeSignature');
		GUI_ticksInBeat				= document.getElementById('ticksInBeat');
		GUI_currentTime				= document.getElementById('currentTime')
		GUI_currentTick				= document.getElementById('currentTick');
		GUI_currentBeatSubdivision 	= document.getElementById('currentBeatSubdivision');
		GUI_currentBeatInBar		= document.getElementById('currentBeatInBar');
		GUI_currentBar				= document.getElementById('currentBar');

		GUI_ticksContainer 			= document.getElementById('ticksContainer');
		GUI_scheduledTicksContainer = document.getElementById('scheduledTicksContainer');
		
		drawMetronomeTicks();
		Pattern_drawTickPointer();
		updateGUI();
	}
	

	//** FUNCTIONS

	function selectTick(tickID){
		var _scheduled  = musicalClock.getScheduleTicks();
		var tickBut = document.getElementById("tickSc-"+tickID)
		if(tickBut.hasAttribute("scheduledBeat")){
			_scheduled.splice(_scheduled.indexOf(tickID), 1);
			tickBut.removeAttribute("scheduledBeat");
		}else{
			_scheduled.push(tickID);
			tickBut.setAttribute("scheduledBeat","true");
		}
		
		tickBut.blur();
		musicalClock.scheduleTicks(_scheduled);
		
	}
	function drawMetronomeTicks(){
		var _html = '';
		for(var i= 1; i <= musicalClock.getBeatResolution(); i++) _html += '<div class="box" id="tick-' + i + '"></div>';
		GUI_ticksContainer.innerHTML = _html;
	}

	function Pattern_drawTickPointer(){
		var _html = '';
		var tickID =1;
		var beats_base_Ticks;
		var scheduledStatus;
		for(var a= 1; a <= measures; a++){ // measures
			for(var b= 1; b <= musicalClock.getBeatsPerBar(); b++){ // beats
				_html += 	'<div class="beatScheduled '+ ((a% 2) ? 'dark' : 'light') +'">';
				for(var i= 1; i <= musicalClock.getBeatResolution(); i++){
					scheduledStatus = (musicalClock.getScheduleTicks().indexOf(tickID) != -1) ? 'scheduledBeat' : ''
					_html += '<div class="box" pointer tabindex="0" id="tickSc-' + tickID + '" ' + scheduledStatus + ' onclick="selectTick(' + tickID + ')"></div>';
					tickID++;
				}	
				_html += '</div>';
			}
		}
		GUI_scheduledTicksContainer.innerHTML = _html;
	}
	
	function start(){
		drawMetronomeTicks();
		Pattern_drawTickPointer();
		musicalClock.play();
	}
	
	function stop(){
		drawMetronomeTicks();
		Pattern_drawTickPointer();
		musicalClock.stop();
		updateGUI();
	}
	
	function tempoModifier(modifier){
		musicalClock.setTempo(musicalClock.getTempo() + modifier);
		updateGUI();
	}
	
	function metronomeSwitch(){
		metronome = !metronome;
		GUI_metronome.innerHTML = (metronome) ? "on" : "off";
	}
	
	function measuresModifier(modifier){
		measures = measures + modifier;
		console.log(measures)
		GUI_measures.innerHTML = measures;
		
		Pattern_drawTickPointer();
		updateGUI();
	}
	
	function timeSignatureModifier(modifier){
		var currentSignatureIndex = commonTimeSignatures.indexOf(musicalClock.getTimeSignature());
		var newIndex = currentSignatureIndex + modifier;

		if(newIndex < 0) newIndex = commonTimeSignatures.length - 1;
		else if(newIndex > commonTimeSignatures.length - 1 ) newIndex = 0;

		musicalClock.setTimeSignature(commonTimeSignatures[newIndex]);
		drawMetronomeTicks();
		Pattern_drawTickPointer();
		updateGUI();
	}
	
	function beatResolutionLevelModifier(modifier){
		var newLevel = musicalClock.getBeatResolutionLevel() + modifier;
		if (newLevel < 0) return false;
		if(newLevel > 5) return false;

		musicalClock.setBeatResolutionLevel(newLevel);
		drawMetronomeTicks();
		Pattern_drawTickPointer();
		updateGUI();
	}
	
	// callback functions
	function updateGUI(){
		GUI_tempo.innerHTML = musicalClock.getTempo() + " bpm";
		GUI_timeSignature.innerHTML = musicalClock.getTimeSignature();
		GUI_ticksInBeat.innerHTML = musicalClock.getBeatResolution() + " ticks";
		GUI_currentTime.innerHTML = musicalClock.getCurrentTime().toFixed(2) + ' sec.';
		GUI_currentTick.innerHTML = musicalClock.getCurrentTick();
		GUI_currentBeatSubdivision.innerHTML = musicalClock.getCurrentSubBeat() + "/" + musicalClock.getBeatResolution();
		GUI_currentBeatInBar.innerHTML = musicalClock.getCurrentBeat() + "/" + musicalClock.getBeatsPerBar();
		GUI_currentBar.innerHTML = musicalClock.getCurrentBar() ;
		
		drawMetronomeTicks()
		//Pattern_drawTickPointer()

					
		var currentSubBeat = musicalClock.getCurrentSubBeat();
		var currentBox = document.getElementById('tick-' + currentSubBeat);
			if(currentBox) currentBox.setAttribute('active',true);
		var currentScBox = document.getElementById('tickSc-' +  musicalClock.getCurrentTick());
			if(currentScBox){
				currentScBox.focus()
		} 
	} 

	function newTone(_vol, _freq, _time){
		var beepSound = musicalClock.audioContext.createOscillator();
		beepSound.frequency.value =  _freq;
		
		beepSound.volume = musicalClock.audioContext.createGain();
		beepSound.volume.gain.value = _vol;
		
		beepSound.connect(beepSound.volume);
		beepSound.volume.connect(musicalClock.audioContext.destination);
		
		// play the beepSound 
		beepSound.start(_time);
		beepSound.stop(_time + .05);
		// add a soft fade out
		beepSound.volume.gain.setTargetAtTime(0.0, _time, 0.01);
		return beepSound;
	}
	
	function playBeep(nextTickStartTime){ 
		var beat = musicalClock.getCurrentSubBeat();
		
		if(metronome){
			// if currentBeatSubdivision is setted in beatPattern definition, play beep sound
			if(beatPattern.hasOwnProperty(beat)) newTone(1.0, beatPattern[beat],nextTickStartTime);	
			// if current beat in bar is setted in barPatter, play beat sound
			if(barPattern.hasOwnProperty(musicalClock.getCurrentBeat()) && musicalClock.getCurrentSubBeat() == 1) newTone(1.0, barPattern[beat],nextTickStartTime);
		}
		
		// if las tick in las measure, loop to begining
		if(musicalClock.getCurrentTick() == measures * ( musicalClock.getBeatsPerBar() * musicalClock.getBeatResolution() +1)){
			musicalClock.setCurrentTick(1)
			return;
		}
	}