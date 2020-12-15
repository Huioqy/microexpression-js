// OpenVidu variables
var OV;
var session;
var publisher;

// Application variables
var role = 'PUBLISHER'; 	// ['SUBSCRIBER', 'PUBLISHER', 'MODERATOR']
var selectedStreamManager; 	// Our Publisher or any Subscriber (see https://openvidu.io/api/openvidu-browser/classes/streammanager.html)



Promise.all([
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models")
	]);

/* OPENVIDU METHODS */

function joinSession() {

	let mySessionId = $("#sessionId").val();
	let myUserName = $("#userName").val();

	// --- 1) Get an OpenVidu object ---

	OV = new OpenVidu();

	// --- 2) Init a session ---

	session = OV.initSession();

	// --- 3) Specify the actions when events take place in the session ---

	// On every new Stream received...
	session.on('streamCreated', event => {

		// Subscribe to the Stream to receive it. HTML video will be appended to element with 'video-container' id
		var subscriber = session.subscribe(event.stream, 'video-container');

		// When the HTML video element has been appended to DOM...
		subscriber.on('videoElementCreated', event => {
			// Add a new <p> element for the user's nickname just below its video
			appendUserData(event.element, subscriber);
		});

		// When the video starts playing remove the spinner
		subscriber.on('streamPlaying', function (event) {
			$('#spinner-' + subscriber.stream.connection.connectionId).remove();
		});

	});

	// On every Stream destroyed...
	session.on('streamDestroyed', event => {

		// Delete the HTML element with the user's nickname. HTML videos are automatically removed from DOM
		removeUserData(event.stream.connection);
	});

	// --- 4) Connect to the session with a valid user token ---

	// 'getToken' method is simulating what your server-side should do.
	// 'token' parameter should be retrieved and returned by your own backend
	getToken(mySessionId, role).then(token => {

		// First param is the token got from OpenVidu Server. Second param can be retrieved by every user on event
		// 'streamCreated' (property Stream.connection.data), and will be appended to DOM as the user's nickname
		session.connect(token, { clientData: myUserName })
			.then(() => {

				// --- 5) Set page layout for active call ---

				$('#session-title').text(mySessionId);
				$('#join').hide();
				$('#session').show();

				// ---- HYQ, auto set default value for video source
				$("#mevideoSource").attr("value",$("#userName").val());

				// --- 6) Get your own camera stream with the desired properties ---

				if (role !== 'SUBSCRIBER') {
					var publisherProperties = {
						audioSource: undefined, // The source of audio. If undefined default microphone
						videoSource: undefined, // The source of video. If undefined default webcam
						publishAudio: false,  	// Whether you want to start publishing with your audio unmuted or not
						publishVideo: true,  	// Whether you want to start publishing with your video enabled or not
						resolution: '1280x720',  // The resolution of your video
						frameRate: 30,			// The frame rate of your video
						insertMode: 'APPEND',	// How the video is inserted in the target element 'video-container'	
						mirror: false       	// Whether to mirror your local video or not
					};


					publisher = OV.initPublisher('video-container', publisherProperties);

					// --- 7) Specify the actions when events take place in our publisher ---

					// When our HTML video has been added to DOM...
					publisher.on('videoElementCreated', function (event) {
						appendUserData(event.element, publisher);
						initMainVideo(publisher, myUserName);
					});
					// When our video has started playing...
					publisher.on('streamPlaying', function (event) {
						$('#spinner-' + publisher.stream.connection.connectionId).remove();
					});

					// --- 8) Publish your stream, indicating you want to receive your remote stream to see the filters ---
					publisher.subscribeToRemote();
					session.publish(publisher);

				} else {
					// Show a message warning the subscriber cannot publish
					$('#main-video video').css("background", "url('resources/images/subscriber-msg.jpg') round");
				}
			})
			.catch(error => {
				console.log('There was an error connecting to the session:', error.code, error.message);
			});
	});
}

function leaveSession() {

	// --- 9) Leave the session by calling 'disconnect' method over the Session object ---
	session.disconnect();

	// Removing all HTML elements with user's nicknames. 
	// HTML videos are automatically removed when leaving a Session
	removeAllUserData();

	// Back to 'Join session' page
	$('#join').show();
	$('#session').hide();
}

/* Micro-Expression Video Control */
// --- FPS calculation variable ---
let previousTime = 0;
let frameCount = 0
let fps;
// --- ME crontrol timer ---
let ME_Timer

function startME() {

    console.log("Run MEVideo");
	
	let mevideosource_username = $("#mevideoSource").val()

	addMicroExEventListener(mevideosource_username);
}

function stopME() {

    console.log("Stop MEVideo");
	
	clearInterval(ME_Timer);
}


function addMicroExEventListener(username){

    console.log('Run addMicroExEventListener');
	
	// Search for the video source based on the username
	let video_xpath = "//div[@id='video-container']//p[text()[contains(., '" +username + "')]]/../preceding-sibling::video[1]"
	let videoSearchResult = document.evaluate(video_xpath, document, null, XPathResult.ANY_TYPE, null);
	let videoSource = videoSearchResult.iterateNext(); //get the first element 
	console.log("Video Source Element: ",videoSource);

	if (videoSource !== null) 
	{	
		// ---- Remote Source
		const video = videoSource

		// ---- Micro Expression Video Drawing Canvas
		const microexCanvas = $("#me-canvas").get(0);
		const displaySize = { width: 570, height: 320};

		faceapi.matchDimensions(microexCanvas, displaySize, true);	

		// set looping timer
		ME_Timer = setInterval( async () => {

			const detections = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks().withFaceExpressions();
		
			microexCanvas.getContext("2d").clearRect(0, 0, microexCanvas.width, microexCanvas.height);
			microexCanvas.getContext("2d").fillStyle = "#00004d";
			microexCanvas.getContext("2d").fillRect(0, 0, microexCanvas.width, microexCanvas.height);

			if (detections){
				const resizedDetections = faceapi.resizeResults(detections, displaySize);
				const mouth = resizedDetections.landmarks.getMouth();
				faceapi.draw.drawFaceLandmarks(microexCanvas, resizedDetections);
				faceapi.draw.drawFaceExpressions(microexCanvas, resizedDetections);

				// ------- FPS Calculation & Display ---------
				
				let currentTime = new Date().getTime();
				++frameCount;

				if (currentTime - previousTime > 1000) // 取固定时间间隔为1秒
				{
					fps = frameCount;
					frameCount = 0;
					previousTime = currentTime;
				}
				// document.getElementById("fps").textContent = 'FPS: '+ fps + ".00";
			}
		}, 100);
	}	
}



/* APPLICATION SPECIFIC METHODS */

window.addEventListener('load', function () {
	generateParticipantInfo();
	$('[data-toggle="tooltip"]').tooltip({ container: 'body', trigger: 'hover' });
});

window.onbeforeunload = function () {
	if (session) session.disconnect();
};

function handleRadioBtnClick(myRadio) {
	this.role = myRadio.value;
}

function generateParticipantInfo() {
	$('#sessionId').val("SessionA");
	$('#userName').val("Participant" + Math.floor(Math.random() * 100));
}

var spinnerNodeHtml =
	'<div class="spinner"><div class="sk-circle1 sk-child"></div><div class="sk-circle2 sk-child"></div><div class="sk-circle3 sk-child"></div>' +
	'<div class="sk-circle4 sk-child"></div><div class="sk-circle5 sk-child"></div><div class="sk-circle6 sk-child"></div><div class="sk-circle7 sk-child"></div>' +
	'<div class="sk-circle8 sk-child"></div><div class="sk-circle9 sk-child"></div><div class="sk-circle10 sk-child"></div><div class="sk-circle11 sk-child"></div>' +
	'<div class="sk-circle12 sk-child"></div></div>';

function appendUserData(videoElement, streamManager) {
	var userData = JSON.parse(streamManager.stream.connection.data).clientData;
	var nodeId = streamManager.stream.connection.connectionId;
	// Insert user nickname
	var dataNode = $('<div id="data-' + nodeId + '" class="data-node"><p>' + userData + '</p></div>');
	dataNode.insertAfter($(videoElement));
	// Insert spinner loader
	var spinnerNode = $(spinnerNodeHtml).attr('id', 'spinner-' + nodeId)
	dataNode.append(spinnerNode);
}

function removeUserData(connection) {
	$("#data-" + connection.connectionId).remove();
}

function removeAllUserData() {
	$(".data-node").remove();
	$('#main-video div p').html('');
}

function initMainVideo(streamManager, userData) {

	// html video element
	var videoEl = $('#main-video video').get(0);
	videoEl.onplaying = () => {
		$('#main-video div .spinner').remove();
	};
	streamManager.addVideoElement(videoEl);
	$('#main-video div p').html(userData);
	$('#main-video div').append($(spinnerNodeHtml));
	$('#main-video video').prop('muted', true);
	selectedStreamManager = streamManager;
}

/**
 * --------------------------
 * SERVER-SIDE RESPONSIBILITY
 * --------------------------
 * These methods retrieve the mandatory user token from OpenVidu Server.
 * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION (by using
 * the REST API, openvidu-java-client or openvidu-node-client):
 *   1) Initialize a session in OpenVidu Server	(POST /api/sessions)
 *   2) Generate a token in OpenVidu Server	(POST /api/tokens)
 *   3) The token must be consumed in Session.connect() method
 */

var OPENVIDU_SERVER_URL = "https://" + location.hostname + ":4443";
var OPENVIDU_SERVER_SECRET = "MY_SECRET";

function getToken(mySessionId, role) {
	return createSession(mySessionId).then(sessionId => createToken(sessionId, role));
}


function createSession(sessionId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-apisessions
	return new Promise((resolve, reject) => {
		$.ajax({
			type: "POST",
			url: OPENVIDU_SERVER_URL + "/api/sessions",
			data: JSON.stringify({ customSessionId: sessionId }),
			headers: {
				"Authorization": "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
				"Content-Type": "application/json"
			},
			success: response => resolve(response.id),
			error: (error) => {
				if (error.status === 409) {
					resolve(sessionId);
				} else {
					console.warn('No connection to OpenVidu Server. This may be a certificate error at ' + OPENVIDU_SERVER_URL);
					if (window.confirm('No connection to OpenVidu Server. This may be a certificate error at \"' + OPENVIDU_SERVER_URL + '\"\n\nClick OK to navigate and accept it. ' +
						'If no certificate warning is shown, then check that your OpenVidu Server is up and running at "' + OPENVIDU_SERVER_URL + '"')) {
						location.assign(OPENVIDU_SERVER_URL + '/accept-certificate');
					}
				}
			}
		});
	});
}


function createToken(sessionId, role) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-apitokens
	var openviduRole;
	var jsonBody = {
		session: sessionId,
		role: role,
		kurentoOptions: {}
	};

	if (openviduRole !== 'SUBSCRIBER') {
		// Only the PUBLISHERS and MODERATORS need to configure the ability of applying filters
		jsonBody.kurentoOptions = {
			allowedFilters: ['FaceOverlayFilter', 'ChromaFilter', 'GStreamerFilter']
		}
	}

	return new Promise((resolve, reject) => {
		$.ajax({
			type: "POST",
			url: OPENVIDU_SERVER_URL + "/api/tokens",
			data: JSON.stringify(jsonBody),
			headers: {
				"Authorization": "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
				"Content-Type": "application/json"
			},
			success: response => resolve(response.token),
			error: error => reject(error)
		});
	});
}
