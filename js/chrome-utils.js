ChromeUtils = {
	device: {
		isChromeApp: function() {
			return true;
		}
	},

	initFs: function(source, callback) {
		console.log("initFs");
		ChromeUtils.callbackInit = callback;
		window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

		if (window.requestFileSystem) {
			navigator.webkitPersistentStorage.requestQuota(220*1024*1024, function(grantedBytes) {
				window.requestFileSystem(window.PERSISTENT, grantedBytes, ChromeUtils.onInitFs, ChromeUtils.errorHandler);
			}, function(e) {
				console.log('Error', e);
			});
		} else {
			console.log("Não tem permissão");
		}
	},

	onInitFs: function(fs) {
		console.log('Opened file system: ' + fs.name);

		ChromeUtils.fs = fs;

		if (ChromeUtils.callbackInit) {
			ChromeUtils.entries = [];

			//ChromeUtils.removeDirectory("/videos");

			ChromeUtils.qtdReader = 0;
			ChromeUtils.readEntries(fs.root.createReader(), true);
		}
	},

	removeDirectory: function(dirPath) {
		ChromeUtils.fs.root.getDirectory(dirPath, {}, function(dirEntry) {
			dirEntry.removeRecursively(function() {
			  console.log('Directory removed.');
			}, ChromeUtils.errorHandler);
		}, ChromeUtils.errorHandler);
  	},

	loadPendingFile: function() {
		ChromeUtils.filesToDownload = [];

		// for (var pageIndex = 0; pageIndex < ComicStructure.pages.length; pageIndex++) {
		// 	var page = ComicStructure.pages[pageIndex];

		// 	//var message = { type: "createDir", folders: ['videos', 'pages', page.name] };
		// 	//window.postMessage(message, "*");

		// 	ChromeUtils.createDir(ChromeUtils.fs.root, ['videos', 'pages', page.name]);
			
		// 	for (var frameIndex = 0; frameIndex < page.frames.length; frameIndex++) {
		// 		var frame = page.frames[frameIndex];
		// 		var isVideoFrame = !(frame.isNarrative || frame.isDialogue);
		// 		var fullPath = '/videos/pages/' + page.name + '/' + frame.name + '.mp4';

		// 		if (isVideoFrame) {
		// 			//var message = { type: "fileExists", fullPath: fullPath };
		// 			//window.postMessage(message, "*");

		// 			if (!ChromeUtils.fileExists(fullPath)) {
		// 				ChromeUtils.filesToDownload.push(fullPath);
		// 				ChromeUtils.totalToDownload = ChromeUtils.filesToDownload.length;
		// 			}
		// 		}
		// 	}
		// }

		ChromeUtils.callbackInit();
	},

	hasPendingFile: function() {
		ChromeUtils.filesToDownload = ChromeUtils.filesToDownload || [];
		return ChromeUtils.filesToDownload.length > 0;
	},

	setFilesToDownload: function(newFilesToDownload) {
		ChromeUtils.filesToDownload = newFilesToDownload;
		ChromeUtils.totalToDownload = newFilesToDownload.length;
	},

	setEntries: function(newEntries) {
		ChromeUtils.entries = newEntries;
	},

	fileExists: function(fullPath) {
		for (var i in ChromeUtils.entries) {
			if (ChromeUtils.entries[i].isFile) {
				if (ChromeUtils.entries[i].fullPath == fullPath) {
					return true;
				}
			}
		}

		return false;
	},

	startDownload: function(statusCallback, progressCallback) {
        ChromeUtils.statusCallback = statusCallback;
        ChromeUtils.progressCallback = progressCallback;
		ChromeUtils.isPaused = false;

        ChromeUtils.downloadNextPendingFile();
	},

	pauseDownload: function() {
		ChromeUtils.isPaused = true;
		ChromeUtils.statusCallback(7);
	},

	getPreviouseChosenDir: function() {
        chrome.storage.local.get('chosenDir', function(items) {
			if (items.chosenDir) {
				// if an entry was retained earlier, see if it can be restored
				chrome.fileSystem.isRestorable(items.chosenDir, function(bIsRestorable) {
					if (bIsRestorable) {
						// the entry is still there, load the content
						chrome.fileSystem.restoreEntry(items.chosenDir, function(chosenEntry) {
							if (chosenEntry) {
								ChromeUtils.rootDir = chosenEntry;
						  		//chosenEntry.isFile ? loadFileEntry(chosenEntry) : loadDirEntry(chosenEntry);
							} else {
								ChromeUtils.askForDir();
							}
						});
					} else {
						ChromeUtils.askForDir();
					}
				});
			} else {
				ChromeUtils.askForDir();
			}
		});
	},

	askForDir: function() {
		chrome.fileSystem.chooseEntry({ "type":"openDirectory" }, function(entry, fileEntries) {
			chrome.storage.local.set({'chosenDir': chrome.fileSystem.retainEntry(entry)});
		});
	},

	downloadNextPendingFile: function() {
		if (ChromeUtils.filesToDownload.length > 0) {
			var message = { type: "downloadFile", filePath: ChromeUtils.filesToDownload[0] };
			window.postMessage(message, "*");
		} else {
			ChromeUtils.statusCallback(5);
		}
	},

	errorHandler: function(e) {
		var msg = '';

		console.log(e);

		switch (e.code) {
			case FileError.QUOTA_EXCEEDED_ERR:
				msg = 'QUOTA_EXCEEDED_ERR';
				break;
			case FileError.NOT_FOUND_ERR:
				msg = 'NOT_FOUND_ERR';
				break;
			case FileError.SECURITY_ERR:
				msg = 'SECURITY_ERR';
				break;
			case FileError.INVALID_MODIFICATION_ERR:
				msg = 'INVALID_MODIFICATION_ERR';
				break;
			case FileError.INVALID_STATE_ERR:
				msg = 'INVALID_STATE_ERR';
				break;
			default:
				msg = 'Unknown Error';
				break;
		};

		console.log('Error: ' + msg);
	},

	createDir: function(rootDirEntry, folders) {
		// Throw out './' or '/' and move on to prevent something like '/foo/.//bar'.
		if (folders[0] == '.' || folders[0] == '') {
			folders = folders.slice(1);
		}
		
		rootDirEntry.getDirectory(folders[0], {create: true}, function(dirEntry) {
			// Recursively add the new subfolder (if we still have another to create).
			if (folders.length > 1) {
				ChromeUtils.createDir(dirEntry, folders.slice(1));
			}
		}, ChromeUtils.errorHandler);
	},

	readEntries: function(dirReader) {
		ChromeUtils.qtdReader++;

		dirReader.readEntries(function(results) {
			ChromeUtils.qtdReader--;

			if (!results.length) {
				if (ChromeUtils.qtdReader == 0) {
					ChromeUtils.loadPendingFile();
				}
			} else {
				ChromeUtils.entries = ChromeUtils.entries.concat(ChromeUtils.toArray(results));

				for (var r in results) {
					if (results[r].isDirectory) {
						ChromeUtils.readEntries(results[r].createReader());
					}
				}

				ChromeUtils.readEntries(dirReader);
			}
		}, ChromeUtils.errorHandler);
	},

	getFileURL: function(filePath, callback) {
		ChromeUtils.getFileURLCallback = callback;

		var message = { type: "getFileURL", filePath: filePath };
		window.postMessage(message, "*");
	},

	callbackGetFileURL: function(url) {
		ChromeUtils.getFileURLCallback(url);
	},

	downloadFile: function(data) {
		ChromeUtils.myWindow.contentWindow.ChromeUtils.statusCallback(2);

		var xhr = new XMLHttpRequest();
		xhr.open('GET', "http://www.draconiancomics.com/mascate" + data.filePath, true);

		xhr.responseType = 'blob';

		xhr.onload = function(e) {
			ChromeUtils.fs.root.getFile(data.filePath, {create: true}, 
				function(fileEntry) {
					fileEntry.createWriter(function(writer) {
						writer.onwrite = function(e) { 
							ChromeUtils.filesToDownload.splice(0, 1);
							ChromeUtils.myWindow.contentWindow.ChromeUtils.setFilesToDownload(ChromeUtils.filesToDownload);

							if (!ChromeUtils.myWindow.contentWindow.ChromeUtils.isPaused) {
								ChromeUtils.myWindow.contentWindow.ChromeUtils.downloadNextPendingFile();
							}
						};
						
						writer.onerror = function(e) { console.log('error', e); };

						var blob = new Blob([xhr.response], {type: 'video/mp4'});
						//var blob = new Blob([xhr.response], {type: 'audio/mpeg3'});
						
						writer.write(blob);
					}, ChromeUtils.onError);
				}, ChromeUtils.onError);
		};

		ChromeUtils.myWindow.contentWindow.ChromeUtils.statusCallback(4);

		var toDownload = ChromeUtils.totalToDownload;
		var pending = ChromeUtils.filesToDownload.length;
		var downloaded = toDownload - pending;
		var percent = parseInt(toDownload == 0 ? 0 : downloaded * 100 / toDownload);
		ChromeUtils.myWindow.contentWindow.ChromeUtils.progressCallback({progress: percent + "% " + downloaded + " / " + toDownload});

		xhr.send();
	},

	triggerDownloadImage: function(url, index, callback) {
		ChromeUtils.callbackDownloadImage = callback;

		var message = { type: "downloadImage", url: url, index: index };
		window.postMessage(message, "*");
	},

	downloadImage: function(url, callback) {
		var filePath = url.replace('http://thewalkingdead-online.com/', '');

		while(filePath.indexOf('/') >= 0 || filePath.indexOf('%20') >= 0) {
			filePath = filePath.replace('/', '_');
			filePath = filePath.replace('%20', '_');
		}

		if (ChromeUtils.fileExists("/" + filePath)) {
			if (callback) {
				callback(filePath);
			}
			return;
		}

		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);

		xhr.responseType = 'blob';

		xhr.onload = function(e) {
			ChromeUtils.fs.root.getFile(filePath, {create: true}, 
				function(fileEntry) {
					fileEntry.createWriter(function(writer) {
						writer.onwrite = function(e) {
							if (callback) {
								callback(filePath);
							}
						};
						writer.onerror = function(e) { console.log('error', e); };

						var blob = new Blob([xhr.response], {type: 'image/jpg'});
						//var blob = new Blob([xhr.response], {type: 'video/mp4'});
						//var blob = new Blob([xhr.response], {type: 'audio/mpeg3'});
						
						writer.write(blob);
					}, ChromeUtils.onError);
				}, ChromeUtils.onError);
		};

		xhr.send();
	},

	onError: function(e) {
		console.log("erro download");
		console.log(e);
	},

	toArray: function(list) {
		return Array.prototype.slice.call(list || [], 0);
	}
}

//ChromeUtils.initFs(null, null);
