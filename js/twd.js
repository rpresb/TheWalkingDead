$(document).ready(function() {
	var self = this;
	self.hqs = [];
	self.shelfs = [];
	self.percent = "0%";
	self.countDone = 0;

	self.getChapters = function(index, callback) {
		$.getJSON('/json/hq' + self.hqs[index].id + '.json').done(function(hq_data) {
			self.hqs[index].chapters = hq_data.chapters;

			ChromeUtils.triggerDownloadImage(self.hqs[index].chapters[0].images[0].imageUrl, index, function(url, originIndex) {
				ChromeUtils.getFileURL(url, function(url) {
					self.hqs[originIndex].coverUrl = url;
					callback();
				});
			});
		}).fail(function(e) {
			console.log(e);
			callback();
		});
	};

	self.createShelf = function() {
		var shelf = [];
		for (var i = 0; i < self.hqs.length; i++) {
			if ((i > 0 && i % 6 == 0)) {
				self.shelfs.push(shelf);
				shelf = [];
			}

			shelf.push(self.hqs[i]);

			if (self.hqs.length == i + 1) {
				self.shelfs.push(shelf);
			}
		}

		self.showCovers();

		$("#downloading").fadeOut(function() {
			$("#downloaded").fadeIn();
		});
		
	};

	self.showCovers = function() {
		var templateItem = $(".book").clone();

		$(".books").empty();

		var templateShelf = $(".shelf").clone();

		$("#downloaded").empty();

		for (var i = 0; i < self.shelfs.length; i++) {
			var currentShelf = templateShelf.clone();

			for (var j = 0; j < self.shelfs[i].length; j++) {
				var currentCover = templateItem.clone();
				$("img", currentCover).attr("src", self.shelfs[i][j].coverUrl);
				currentCover.find(".title").text(self.shelfs[i][j].name);
				currentCover.find(".description").text(self.shelfs[i][j].description);
				currentCover.data("id", self.shelfs[i][j].id);

				$(".books", currentShelf).append(currentCover);
			}

			$("#downloaded").append(currentShelf);
		}

		$(".book").on("mouseover", function(e) {
			$(".bookclone").remove();

			var clone = $(this).clone();
			clone.removeClass('book');
			clone.addClass('bookclone');
			clone.data("id", $(this).data("id"));

			clone.css('left', $(this).offset().left);

			$(this).parent().parent().prepend(clone);

			$(".bookclone").on('click', function() {
				self.showBook($(this).data("id"));
			});
		});
	};

	self.showBook = function(id) {
		var bookView = $(".book-view");
		bookView.empty().append('<div class="flipbook"></div>');

		var flipbook = $('.flipbook');

		flipbook.empty();

		var hq = self.hqs[id - 1];

		for (var i = 0; i < hq.chapters.length; i++) {
			for (var j = 0; j < hq.chapters[i].images.length; j++) {
				//flipbook.append('<div style="background-image:url(img/loader.gif)" data-imageurl="' + hq.chapters[i].images[j].imageUrl + '" data-loaded="false"></div>');
				flipbook.append('<div><img src="img/loading.gif" data-imageurl="' + hq.chapters[i].images[j].imageUrl + '" data-loaded="false"/></div>');
			}
			flipbook.append('<div class="ad">Propaganda</div>');
		}

		bookView.fadeIn();
		bookView.unbind('mousewheel DOMMouseScroll');
		bookView.bind('mousewheel DOMMouseScroll', function(e) {
			e.preventDefault();
		});

		var zoomView = $(".zoom-view");
		zoomView.unbind('mousewheel DOMMouseScroll');
		zoomView.bind('mousewheel DOMMouseScroll', function(e) {
		    var e0 = e.originalEvent,
		        delta = e0.wheelDelta || -e0.detail;

		    this.scrollTop += ( delta < 0 ? 1 : -1 ) * 10;
		    e.preventDefault();
		});

		flipbook.turn({
			width: 380 * 2,
			height: bookView.height(),
			elevation: 50,
			gradients: true,
			autoCenter: false,
			when: {
				turning: function(e, page, view) {
					self.isChanging = true;
					self.loadPendingImage();
				},
				turned: function(e, page, view) {
					self.isChanging = false;
				},
				end: function() {
					self.bindZoom();
				}
			}
		});

		self.loadPendingImage();
		self.bindZoom();

		$(window).on("keydown", function(e) {
			if (e.keyCode == 27) {
				if (self.isZoom) {
					zoomView.trigger('click');
				} else {
					$(window).off("keydown");
					bookView.fadeOut();
				}
			}
		});
	};

	self.loadPendingImage = function() {
		var pendingImages = $('.flipbook').find("img[data-loaded=false]");

		if (pendingImages.length > 0) {
			var firstPending = $(pendingImages[0]);
			var url = firstPending.data("imageurl");

			ChromeUtils.triggerDownloadImage(url, 0, function(url, originIndex) {
				ChromeUtils.getFileURL(url, function(url) {

					// firstPending.on('load', function() {
					// 	console.log(firstPending.width(), firstPending.height());

					// 	if (firstPending.width() > firstPending.height()) {
					// 		firstPending.addClass("landscape");
					// 	} else {
					// 		firstPending.removeClass("landscape");
					// 	}
					// });

					firstPending.attr("data-loaded", true);
					firstPending.attr('src', url);


					setTimeout(function() {
						self.loadPendingImage();
					}, 50);
				});
			});
		}

	};

	self.updateProgress = function() {
		$(".meter > span").css("width", self.percent + "%");
	};

	$("#downloading").show();
	$("#downloaded").hide();

	self.loadApp = function() {
		$.getJSON('/json/hqs.json').done(function(data) {
			self.hqs = data.hqs;

			var that = this;

			var getNextChapter = function(currentChapter) {
				self.getChapters(currentChapter, function() {
					currentChapter++;
					var percent = parseInt((currentChapter + 1) * 100 / self.hqs.length, 10);
					if (percent > 100) {
						percent = 100;
					}
					self.percent = percent + "%";
					self.updateProgress();

					if (currentChapter < self.hqs.length) {
						setTimeout(function() {
							getNextChapter(currentChapter);
						}, 100);
					} else {
						self.createShelf();
					}
				});
			};

			getNextChapter(0);

		});
	};

	self.bindZoom = function() {
		var bookView = $(".book-view");
		var zoomView = $(".zoom-view");

		$(".flipbook img").off('click');
		$(".flipbook img").on('click', function(e) {
			self.isZoom = true;
			if (!self.isChanging) {
			    var pos = {
			        x: e.pageX - $(this).offset().left,
			        y: e.pageY - $(this).offset().top
			    };

			    var imageZoom = $(this).clone();
			    imageZoom.addClass('zoom');

			    bookView.hide();
			    zoomView.append(imageZoom).show().scrollTop(0);

			    zoomView.on('click', function() {
				    bookView.show();
				    zoomView.empty().hide();
				    zoomView.off('click');
				    self.isZoom = false;
			    });
			}
		});
	};

	yepnope({
		test: Modernizr.csstransforms,
		yep: ['js/turn.min.js'],
		nope: ['js/turn.html4.min.js'],
		both: ['css/basic.css'],
		complete: self.loadApp
	});
});