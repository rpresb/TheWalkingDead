chrome.app.runtime.onLaunched.addListener(function() {
  var openWindow = function() {
    chrome.app.window.create('index.html',
      {
        bounds: {width: 1130, height: 600}
      },
      function (myWindow) {
        ChromeUtils.myWindow = myWindow;
        console.log(ChromeUtils.myWindow);

        myWindow.contentWindow.addEventListener('load', function(e) {
          myWindow.contentWindow.ChromeUtils.setEntries(ChromeUtils.entries);
          myWindow.contentWindow.ChromeUtils.setFilesToDownload(ChromeUtils.filesToDownload);
        });

        myWindow.contentWindow.addEventListener('message', function(e) {
          switch (e.data.type) {
            case "createDir":
              ChromeUtils.createDir(ChromeUtils.fs.root, e.data.folders);
              break;
            case "downloadFile":
              ChromeUtils.downloadFile(e.data);
              break;
            case "downloadImage":
              ChromeUtils.downloadImage(e.data.url, function(url) {
                myWindow.contentWindow.ChromeUtils.callbackDownloadImage(url, e.data.index);
              });
              break;
            case "fileExists":
              var exists = ChromeUtils.fileExists(e.data.fullPath);
              myWindow.contentWindow.ChromeUtils.addFileToDownload(e.data.fullPath, exists);
              break;
            case "getFileURL":
              ChromeUtils.fs.root.getFile(e.data.filePath, {create: false}, 
                function(fileEntry) {
                  fileEntry.file(function(file) {
                    // var reader = new FileReader();

                    // reader.onloadend = function(e) {
                    //  var txtArea = document.createElement('textarea');
                    //  txtArea.value = this.result;
                    //  document.body.appendChild(txtArea);
                    // };

                    // reader.readAsText(file);
                    var url = window.URL.createObjectURL(file);
                    console.log(url);
                    myWindow.contentWindow.ChromeUtils.callbackGetFileURL(url);
                  }, ChromeUtils.onError);
                }
              );

              break;
          }
        });

      }
    );
  };

  console.log('init');

  ChromeUtils.initFs(this, openWindow);
});
