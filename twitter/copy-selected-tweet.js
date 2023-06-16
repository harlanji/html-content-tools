// ===========================
//   Copy selected Tweet with formatting
// ===========================
//
// Install by pasting into Web Developer Tools
//
// 1) Copy the contents of this file - configurating and templates are below
// 2) Access Web Dev Tools console in the web browser by pressing 
//    ctrl + shift + i.
// 3) Paste into the console and press enter to run
// 4) Now highlighting part of a Tweet will copy it with formatting by pressing
//    ctrl + c
//
// Version: 2022-07-31
//
// Changelog:
//
// 2022-07-31 - fix bug: unable to copy tweet with no text (eg. card only).
//            - get emojis in copied text.
// 2022-07-27 - initial release



// ------------------------------ CONFIGURATION IS BELOW THIS LINE -------------------------------

// select or create a format from below that will be used to shape the clipboard data.
var DEFAULT_FORMAT = noteCardFormat;

// visually confirm when a copy has occured with a simulated camera flash.
var ENABLE_FLASH = true;

// hook into ctrl + c when pressed with a selection within a Tweet text element.
var ENABLE_CLIPBOARD_COPY = true;

// select how emoji is copied. 0 = none, 1 = emoji, 2 = emoji label.
var EMOJI_STYLE = 1;


// ADVANCED: for console usage only, mainly by programmers.
// writing to the clipboard requires the browser window be in focus; this is 
// time allowed to switch to the browser window and focus it.
var COPY_TIMEOUT_SEC = 2;

// ADVANCED: estimate replies from the display tweet view. it loads them upon scroll and hides 
// sensitive content and similar, but we can simulate events to make them load.
var BETA_ESTIMATE_DISPLAY_REPLIES = false;

// ------------------------------ TEMPLATES ARE BELOW THIS LINE -------------------------------

function noteCardFormat (tweet) {
	if (!tweet) { return ""; }
	
	var now = new Date();
	
	var s = `---

${formatTime(now)}

${extendedFormat(tweet)}

`;

	return s;
}

function simpleFormat (tweet) {
	if (!tweet) { return ""; }

	var s;
	with (tweet) {
		if( !tweet['link'] ) { link = null; }
		
		s = 
`${link || ''}

${display_name}
@${handle}
${time}

${text || '(no text)'}
`;
	}
	return s.trim();
}

function extendedFormat (tweet) {
	if (!tweet) { return ""; }
	
	var s;
	
	with (tweet) {
		var total_rt_count = (quote_tweet_count || 0) + (retweet_count || 0);
		s = 
`${link || ''}

${display_name}
@${handle}
${time}
${!isNaN(reply_count) ? reply_count : 'unknown'} replies, ${total_rt_count} rts, ${like_count} likes
${tweet['social_context'] ? social_context.text : ''}

${text || '(no text)'}

${tweet['card'] ? "Card:\n" + cardFormat(card) : ''}

${tweet['quote'] ? "Quoted Tweet:\n" + simpleFormat(quote) : ''}
`;
	}
	return s.trim();
}

function cardFormat (card) {
	if (!card) { return ""; }
	
	var s;
	with (card) {
		s = 
`${link || ''}

${domain}
${title}
${text}
`;
	}
	return s;
}

// ADVANCED: this is mainly for programmers. it copies the raw data structure.
function jsonFormat (tweet) {
	return JSON.stringify(tweet, null, 2);
}

// ------------------------------ DO NOT EDIT BELOW THIS LINE -------------------------------

if (ENABLE_CLIPBOARD_COPY) {
	installCopyHandler();
}

function formatTime (date) {
	return ("" + date.getHours()).padStart(2, "0")
		+ ":" + ("" + date.getMinutes()).padStart(2, "0")
		+ ":" + ("" + date.getSeconds()).padStart(2, "0")
}

function getSelectedTweetEl () {
	var sel = window.getSelection();
	var p = sel.anchorNode.parentElement;
	while (p && p.getAttribute('data-testid') != 'tweet') {
		p = p.parentElement;
	}
	
	if (p == null) {
		console.error('no tweet selected');
		return null;
	}
	
	return p;
}

function getSelectedTweetContainer (tweetEl) {
	var p = tweetEl;
	while (p && p.getAttribute('role') != 'region') {
		p = p.parentElement;
	}
	
	if (p == null) {
		console.error('tweet has no region');
		return null;
	}
	
	return p;
}


function getSelectedTweet () {
	var tweetEl = getSelectedTweetEl();
	
	if (!tweetEl) {
		throw new Error('no Tweet element could be found.');
	}

	// kinda janky but the main difference between timeline
	// and display tweet is  how the date/time is displayed.
	var timeEl = tweetEl.querySelector("time");
	var quoteEl = tweetEl.querySelector('div[role="link"]');
	var hasTimestamp = timeEl && (!quoteEl  || !quoteEl.contains(timeEl));
	
	var isDisplayPage = true && document.location.href.match(/twitter\.com\/[^\/]+\/status\/[\d]+/);

	if (isDisplayPage && !hasTimestamp) {
		return getTweetFromDisplayEl(tweetEl);
	} else {
		return getTweetFromTimelineEl(tweetEl);
	}
}



// works on timeline and search results
// does not work for Tweet view. just needs some tweaks.
// we should just have distinct functions instead of cases here.

function getTweetFromTimelineEl (fullTweetEl) {
	
	var tweetEl = fullTweetEl.firstElementChild.firstElementChild.firstElementChild.children[1];

	// change this to a - what breaks?
	var [avatarEl, displayNameEl, handleEl, timestampEl] = tweetEl.querySelectorAll('a[role="link"]')

	// no TS is likely promoted.
	// hash tags can create a false positive.
	// we could test for the parent.
	// TS time is a span on the view tweet page
	if (timestampEl.href.indexOf("twitter.com/") == -1 || timestampEl.href.indexOf("/status/") == -1 || !timestampEl.querySelector("time")) {
		timestampEl = null
	}

	var tweetTextEl = tweetEl.querySelector('*[data-testid="tweetText"]')

	var isVerified = displayNameEl.querySelector('*[aria-label="Verified account"]') != null;

	var displayTime =  timestampEl ? timestampEl.innerText : null;
	var ts = timestampEl ? timestampEl.querySelector("time").getAttribute("datetime") : null;


	var tweet = {time: ts,
			 link: timestampEl && timestampEl.href,
			 display_time: displayTime,
			 display_name: innerTextWithImgAlt(displayNameEl),
			 handle: handleEl.innerText.substr(1),
			 is_verified: isVerified,
			 text: tweetTextEl && innerTextWithImgAlt(tweetTextEl),
			 profile_link: handleEl.href,

			 // does not work for main tweet or selected reply in tweet view
			 avi_icon: avatarEl.querySelector("img").src
			 };

	tweet.reply_count = NaN;
	tweet.retweet_count = NaN;
	tweet.like_count = NaN;
	tweet.quote_tweet_count = NaN;

	var repliesEl = tweetEl.querySelector('*[data-testid="reply"]');
	var retweetsEl = tweetEl.querySelector('*[data-testid="retweet"]');
	var likesEl = tweetEl.querySelector('*[data-testid="like"]');
	
	if (repliesEl) {
		tweet.reply_count = parseCount(repliesEl.innerText) || 0;
	}
	
	if (retweetsEl) {
		tweet.retweet_count = parseCount(retweetsEl.innerText) || 0;
	}
	
	if (likesEl) {
		tweet.like_count = parseCount(likesEl.innerText) || 0;
	}


	var linkEls = tweetTextEl ? tweetTextEl.querySelectorAll("a") : [];
	if (linkEls.length) {
		var links = Array.from(linkEls).map(function (linkEl) { return {text: innerTextWithImgAlt(linkEl), link: linkEl.href}; });
		tweet.links = links;
	}


	var socialContextEl = tweetEl.previousElementSibling && tweetEl.previousElementSibling.querySelector('*[data-testid="socialContext"]');
	if (socialContextEl) {
		tweet.social_context = {
			text: innerTextWithImgAlt(socialContextEl), 
			display_name:  innerTextWithImgAlt(socialContextEl.querySelector("span"))
		};
	}

	if (avatarEl.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.nextElementSibling) {
		tweet.is_thread = true;
	}

	// FIXME: reply-to without tweet text is possible
	if (tweetTextEl && tweetTextEl.parentElement.previousElementSibling) {
		var replyToEl = tweetTextEl.parentElement.previousElementSibling;

		tweet.replying_to = {
			text: innerTextWithImgAlt(replyToEl),
			handle: replyToEl.querySelector("a").innerText.substr(1),
			user_link: replyToEl.querySelector("a").href
		}
	}

	var cardEl = tweetEl.querySelector('*[data-testid="card.wrapper"]');

	if (cardEl) {
		var [cardDomainEl, _, cardTitleEl, _, cardTextEl] = cardEl.querySelectorAll("span")
		
		// problem: doesn't seem to be set for youtube.com
		var cardLinkEl = cardEl.querySelector('*[role="link"]');

		var card = {
			link: cardLinkEl && cardLinkEl.href,
			domain: cardDomainEl.innerText,
			title: innerTextWithImgAlt(cardTitleEl),
			text: cardTextEl && innerTextWithImgAlt(cardTextEl),
			preview_image: null
		 };
		tweet.card = card;
	}

	var avatarEl = tweetEl.querySelector('*[data-testid="UserAvatar-Container-unknown"]');
	var quoteEl = tweetEl.querySelector('div[role="link"]');
	var timestampEl = quoteEl && quoteEl.querySelector("span time");

	if (avatarEl && quoteEl && timestampEl) {
		var spans = quoteEl.querySelectorAll("span");
		var [displayNameEl, _, handleEl] = spans;
		var tweetTextEl = quoteEl.querySelector('*[data-testid="tweetText"]');
		
		var isVerified = quoteEl.querySelector('*[aria-label="Verified account"]') != null;

		var quote = {
			time: timestampEl && timestampEl.getAttribute("datetime"),
			display_time: timestampEl && timestampEl.innerText,
			display_name: innerTextWithImgAlt(displayNameEl),
			handle: handleEl.innerText.substr(1),
			is_verified: isVerified,
			text: tweetTextEl && innerTextWithImgAlt(tweetTextEl),
			//profile_link: handleEl.href,
			//link: timestampEl.href,
			avi_icon: avatarEl.querySelector("img").src
		};

		if (spans.length >= 10 && spans.item(9).innerText == "Show this thread") {
			quote.is_thread = true;
		}

		if (quoteEl.querySelector("*[aria-label='Embedded video']")) {
			quote.has_video = true;
		}

		if (quoteEl.querySelector("*[aria-label='Image']")) {
			quote.has_image = true;
		}

		tweet.quote = quote;
	}


	var t;
	if ((t = tweetEl.querySelector("*[aria-label='Embedded video']")) && (!quoteEl || !quoteEl.contains(t))) {
		tweet.has_video = true;
	}

	// doesn't work for promoted
	if ((t = tweetEl.querySelector("*[aria-label='Image']")) && (!quoteEl || !quoteEl.contains(t)) ) {
		tweet.has_image = true;
	}


	try {
		if (tweetEl.lastElementChild.lastElementChild.lastElementChild.innerText == 'Promoted') {
			tweet.is_promoted = true;
		}
	} catch (e) {
		console.error('Error checking if tweet is promoted.', e);
	}

	return tweet;
}




// within article[data-testid="tweet"]

function getTweetFromDisplayEl (tweetEl) {
	var containerEl = getSelectedTweetContainer (tweetEl);
	
	var authorInfoEl = tweetEl.firstElementChild.firstElementChild.firstElementChild.children[1];
	var tweetBodyEl = tweetEl.firstElementChild.firstElementChild.firstElementChild.children[2];

	var bodyLinkEls =  tweetBodyEl.querySelectorAll('a[role="link"]');
	var authorLinkEls =  authorInfoEl.querySelectorAll('a[role="link"]');

	var [avatarEl, displayNameEl, handleEl] = authorLinkEls;
	var timestampEl = Array.from(bodyLinkEls).find(function (el) {
		var span = el.querySelector('span');
		if (!span) { return false; }
		
		var ts = new Date(span.innerText.replace(/[^\dA-Za-z\ :,]/g, ''));
		return !isNaN(ts.getTime());
	});

	// no TS is likely promoted.
	// hash tags can create a false positive.
	// we could test for the parent.
	// TS time is a span on the view tweet page
	if (timestampEl && (timestampEl.href.indexOf("twitter.com/") == -1 || timestampEl.href.indexOf("/status/") == -1 )) {
		timestampEl = null
	}

	var tweetTextEl = tweetEl.querySelector('*[data-testid="tweetText"]')

	var isVerified = displayNameEl.querySelector('*[aria-label="Verified account"]') != null;

	var displayTime =  timestampEl ? timestampEl.querySelector("span").innerText : null;
	var ts = displayTime && new Date(displayTime.replace(/[^\dA-Za-z\ :,]/g, ''));

	var tweet = {time: ts,
			 link: timestampEl && timestampEl.href,
			 display_time: displayTime,
			 display_name: innerTextWithImgAlt(displayNameEl),
			 handle: handleEl.innerText.substr(1),
			 is_verified: isVerified,
			 text: tweetTextEl && innerTextWithImgAlt(tweetTextEl),
			 profile_link: handleEl.href,

			 // does not work for main tweet or selected reply in tweet view
			 avi_icon: avatarEl.querySelector("img").src
			 };

	// we don't do anything with these but we can put their counts in
	// these are different in displayTweet
	var engagementEls = tweetEl.querySelectorAll('*[role="group"] *[role="link"]');
	
	tweet.reply_count = NaN;
	tweet.retweet_count = NaN;
	tweet.like_count = NaN;
	tweet.quote_tweet_count = NaN;

	if (BETA_ESTIMATE_DISPLAY_REPLIES && containerEl) {
		tweet.reply_count = containerEl.querySelectorAll('article').length - 1;
		tweet.reply_count_is_estimate = true;
	}
	
	engagementEls.forEach(function (el) {
		var elText = el.innerText;
		
		if (!elText) {
			console.debug('no elText');
			console.debug(e);
			console.log('x');
			return;
		}
		
		var count = parseCount(elText);
		
		if (elText.indexOf('Retweet') != -1) {
			tweet.retweet_count = count;
		} else if (elText.indexOf('Like') != -1) {
			tweet.like_count = count;
		} else if (elText.indexOf('Quote Tweet') != -1) {
			tweet.quote_tweet_count = count;
		}
	});

	var linkEls = tweetTextEl ? tweetTextEl.querySelectorAll("a") : [];
	if (linkEls.length) {
		var links = Array.from(linkEls).map(function (linkEl) { return {text: innerTextWithImgAlt(linkEl), link: linkEl.href}; });
		tweet.links = links;
	}
	
	var socialContextEl = authorInfoEl.previousElementSibling && authorInfoEl.previousElementSibling.querySelector('*[data-testid="socialContext"]');
	


	
	if (socialContextEl) {
		tweet.social_context = {
			text: innerTextWithImgAlt(socialContextEl), 
			display_name: innerTextWithImgAlt(socialContextEl.querySelector("span"))
		};
	}

	if (avatarEl.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.nextElementSibling) {
		tweet.is_thread = true;
	}

	// FIXME: reply-to without tweet text is possible
	if (tweetTextEl && tweetTextEl.parentElement.previousElementSibling) {
		var replyToEl = tweetTextEl.parentElement.previousElementSibling;

		tweet.replying_to = {
			text: innerTextWithImgAlt(replyToEl),
			handle: replyToEl.querySelector("a").innerText.substr(1),
			user_link: replyToEl.querySelector("a").href
		}
	}

	var cardEl = tweetEl.querySelector('*[data-testid="card.wrapper"]');

	if (cardEl) {
		var [cardDomainEl, _, cardTitleEl, _, cardTextEl] = cardEl.querySelectorAll("span")
		
		// problem: doesn't seem to be set for youtube.com
		var cardLinkEl = cardEl.querySelector('*[role="link"]');

		var card = {
			link: cardLinkEl && cardLinkEl.href,
			domain: cardDomainEl.innerText,
			title: innerTextWithImgAlt(cardTitleEl),
			text: cardTextEl && innerTextWithImgAlt(cardTextEl),
			preview_image: null
		 };
		tweet.card = card;
	}

	var avatarEl = tweetEl.querySelector('*[data-testid="UserAvatar-Container-unknown"]');
	var quoteEl = tweetEl.querySelector('div[role="link"]');
	var timestampEl = quoteEl && quoteEl.querySelector("span time");

	if (avatarEl && quoteEl && timestampEl) {
		
		var spans = quoteEl.querySelectorAll("span");
		var [displayNameEl, _, handleEl] = spans;
		var tweetTextEl = quoteEl.querySelector('*[data-testid="tweetText"]');
		
		var isVerified = quoteEl.querySelector('*[aria-label="Verified account"]') != null;

		var quote = {
			time: timestampEl && timestampEl.getAttribute("datetime"),
			display_time: timestampEl && timestampEl.innerText,
			display_name: innerTextWithImgAlt(displayNameEl),
			handle: handleEl.innerText.substr(1),
			is_verified: isVerified,
			text: tweetTextEl && innerTextWithImgAlt(tweetTextEl),
			//profile_link: handleEl.href,
			//link: timestampEl.href,
			avi_icon: avatarEl.querySelector("img").src
		};

		if (spans.length >= 10 && spans.item(9).innerText == "Show this thread") {
			quote.is_thread = true;
		}

		if (quoteEl.querySelector("*[aria-label='Embedded video']")) {
			quote.has_video = true;
		}

		if (quoteEl.querySelector("*[aria-label='Image']")) {
			quote.has_image = true;
		}

		tweet.quote = quote;
	}


	var t;
	if ((t = tweetEl.querySelector("*[aria-label='Embedded video']")) && (!quoteEl || !quoteEl.contains(t))) {
		tweet.has_video = true;
	}

	// doesn't work for promoted
	if ((t = tweetEl.querySelector("*[aria-label='Image']")) && (!quoteEl || !quoteEl.contains(t)) ) {
		tweet.has_image = true;
	}

	try {
		if (tweetEl.lastElementChild.lastElementChild.lastElementChild.innerText == 'Promoted') {
			tweet.is_promoted = true;
		}
	} catch (e) {
		console.error('Error checking if tweet is promoted.', e);
	}

	return tweet;
}


function parseCount (text) {
	var trimmedCount = text.match(/[\d,\.]+[KM]?/) + "";
	if (trimmedCount.endsWith('K')) {
		trimmedCount = trimmedCount.replace(/K$/, '000');
	}
	if (trimmedCount.endsWith('M')) {
		trimmedCount = trimmedCount.replace(/M$/, '000000');
	}
	
	if (trimmedCount.indexOf('.') != -1) {
		trimmedCount = trimmedCount.replace(/0$/, '');
	}

	return parseInt(trimmedCount.replace(/[^\d]/g, ''));
}







function copyToClipboard (text) {
	navigator.clipboard.writeText(text);
}


function copySelectedTweet (formatFn) {
	if (!formatFn) { formatFn = DEFAULT_FORMAT; }
	
	console.log(`Switch to browser tab within ${COPY_TIMEOUT_SEC} seconds to copy.`);
	var tweet = getSelectedTweet();
	
	setTimeout(function () {
		copyToClipboard(formatFn(tweet));
		if (ENABLE_FLASH) {
			flashWindow();
		}
	}, COPY_TIMEOUT_SEC * 1000);
		
		
}


function copySelectedTweetHandler_factory (formatFn) {
	return function copySelectedTweetHandler (e) {
		if (!formatFn) { formatFn = DEFAULT_FORMAT; }

		if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
			try {
				var tweet = getSelectedTweet();
				e.preventDefault();
				copyToClipboard(formatFn(tweet));
				
				if (ENABLE_FLASH) {
					flashWindow();
				}
			} catch (e) {
				console.error('Error copying tweet', e);
			}
		}
	}
}

var _COPY_HANDLER;
function installCopyHandler (formatFn) {
	if (_COPY_HANDLER) {
		document.removeEventListener('keydown', _COPY_HANDLER);
	}
	_COPY_HANDLER = copySelectedTweetHandler_factory(formatFn);
	
	document.addEventListener('keydown', _COPY_HANDLER);
}

function flashWindow () {
	var flashEl = document.createElement("div");
	flashEl.setAttribute("style", "position: fixed; top: 0; left: 0; right: 0; bottom: 0; opacity: 30%; background-color: white; z-index: 9999;");
	document.body.appendChild(flashEl);
	setTimeout(function () {
		document.body.removeChild(flashEl);
	}, 150);
}

// select how emoji is copied. 0 = none, 1 = emoji, 2 = emoji label.
var EMOJI_STYLE = 1;
function innerTextWithImgAlt (el) {
	var nodeIterator = document.createNodeIterator(el);

	var text = '';
	var currentNode;
	while (currentNode = nodeIterator.nextNode()) {
	  if (currentNode.nodeType == Node.TEXT_NODE) {
		  text += currentNode.textContent;
	  } else if (currentNode.nodeType == Node.ELEMENT_NODE && currentNode.nodeName.toLowerCase() == 'img') {
		  if (EMOJI_STYLE == 1) {
			text += currentNode.alt;
		  } else if (EMOJI_STYLE == 2) {
			text += '(' + currentNode.title + ')';
		  }
	  }
	}

	return text;
}

/*


# Reproduce bug

## Capture Tweet HTML

1)

var tweetEl = getSelectedTweetEl();
var testHTML = tweetEl.outerHTML;
console.log(testHTML);

2)

Right click > copy string contents or use displayed "Copy" button,

## Create element to debug with

1) 


var testHTML = ``;

(do not press enter yet)

2)

And then paste captured HTML between the backticks

3)

var testEl = document.createElement('div');
testEl.innerHTML = testHTML;

var tweetEl = testEl.firstChild;
getTweetFromTimelineEl(tweetEl);



*/

