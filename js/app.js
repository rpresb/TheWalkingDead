(function() {
	var app = angular.module('twd', []);

	app.factory('DownloadAPI', function() {
		return {
			saveHQ: function(key, value) {
				var jsonfile = {};
				jsonfile[key] = JSON.stringify(value);

				chrome.storage.sync.set(jsonfile, function() {});
			},
			getHQ: function(key, callback) {
				chrome.storage.sync.get(key, function(obj) {
					callback(JSON.parse(obj[key]));
				});
			},
			getHqAndChapters: function($http, that, callback, statusCallback) {
				var self = this;

				$http.get('http://thewalkingdead-online.com/hq/albums/HQ/')
				.success(function(data) {
					var availablehqs = $(data);

					availablehqs.find('li').each(function(index) {
						if (index > 0) {        
							var href = $(this).find('a').attr("href");
							var text = $(this).text();

							that.hqs.push({ href: href, text: text });
						}
					});

					self.saveHQ('hqs', that.hqs);

					var getImages = function(hq_index, chapters, chapter_index, callback_images) {
						var hq = that.hqs[hq_index];
						var chapter = chapters[chapter_index];

						var url = 'http://thewalkingdead-online.com/hq/albums/HQ/' + hq.href + chapter.href;

						$http.get(url)
						.success(function(data) {
							var availableImages = $(data);
							var images = [];

							availableImages.find('li').each(function(index) {
								if (index > 0) {        
									var href = $(this).find('a').attr("href");
									var text = $(this).text();

									images.push({ href: href, text: text, imageUrl: url + href });
								}
							});

							that.hqs[hq_index].chapters[chapter_index].images = images;
							self.saveHQ('hq_' + hq_index + "_" + chapter_index, images);

							if (chapters.length > chapter_index + 1) {
								getImages(hq_index, chapters, chapter_index + 1, callback_images);
							} else {
								callback_images();
							}

						});
					};

					var getChapters = function(hqs, index) {
						$http.get('http://thewalkingdead-online.com/hq/albums/HQ/' + hqs[index].href)
						.success(function(data) {
							var availableChapters = $(data);
							var chapters = [];

							if (index == 17) {
								chapters = [{ href: "", text: "18/" }]
							} else {
								availableChapters.find('li').each(function(index) {
									if (index > 0) {        
										var href = $(this).find('a').attr("href");
										var text = $(this).text();

										chapters.push({ href: href, text: text });
									}
								});
							}

							that.hqs[index].chapters = chapters;

							self.saveHQ('hq_' + index, chapters);
							getImages(index, chapters, 0, function() {
								if (hqs.length > index + 1) {
									getChapters(hqs, index + 1);

									if (statusCallback) {
										statusCallback();
									}
								} else {
									if (callback) {
										callback();
									}
								}
							});


						});
					};

					getChapters(that.hqs, 0);
				})
				.error(function(response) {
					chrome.storage.sync.get('hqs', function(obj) {
						that.hqs = JSON.parse(obj.hqs);

						if (callback) {
							callback();
						}
					});
				});
			}
		};
	});

	app.controller("MainController", ['$http', 'DownloadAPI', function($http, DownloadAPI) {
		var self = this;
		self.hqs = [];
		self.downloading = false;
		self.shelfs = [];
		self.percent = "0%";
		self.countDone = 0;

		this.isDownloading = function() {
			return self.downloading;
		};

		this.getChapters = function(index, callback) {
			$http.get('/json/hq' + self.hqs[index].id + '.json').success(function(hq_data) {
				self.hqs[index].chapters = hq_data.chapters;

				ChromeUtils.triggerDownloadImage(self.hqs[index].chapters[0].images[0].imageUrl, index, function(url, originIndex) {
					ChromeUtils.getFileURL(url, function(url) {
						self.hqs[originIndex].coverUrl = url;
						console.log("downloaded", originIndex, url);

						callback();
					});
				});
			}).error(function(e) {
				console.log(e);
				callback();
			});
		};

		this.createShelf = function() {
			console.log('createShelf', self.hqs);
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

			console.log(self.shelfs);
		};

		$http.get('/json/hqs.json').success(function(data) {
			self.hqs = data.hqs;

			var that = this;

			var getNextChapter = function(currentChapter) {
				console.log('getNextChapter', currentChapter);
				self.getChapters(currentChapter, function() {
					currentChapter++;
					console.log(currentChapter, self.hqs.length);

					if (currentChapter < self.hqs.length) {
						getNextChapter(currentChapter);
					} else {
						self.createShelf();
					}
				});
			};

			getNextChapter(0);

		});

		// DownloadAPI.getHqAndChapters($http, self, function() {
		// 	self.downloading = false;

		// 	$http.post('http://jsonlint.com/', {hqs: self.hqs});


		// }, function() {
		// 	var count = self.hqs.length;
		// 	self.countDone++;

		// 	var percent = parseInt(self.countDone * 100 / count, 10);

		// 	self.percent = percent + "%";
		// });
	}]);
})();
