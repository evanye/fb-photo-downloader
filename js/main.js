$('#login').click(function(){
    login();
});

window.fbAsyncInit = function() {
    FB.init({
        appId      : '382236208579095',
        status     : true, // check login status
        cookie     : true, // enable cookies to allow the server to access the session
        xfbml      : true  // parse XFBML
    });

    FB.Event.subscribe('auth.authResponseChange', function(response) {
        if (response.status === 'connected') {
            console.log("connected");
            addFriend(response.authResponse.userID, "me");
            startUI();
        } else /* if (response.status === 'not_authorized') */ {
            console.log("authorization failed");
        }

    });
};

function login() {
    FB.login(function(response){
        console.log("logged in");
    }, {scope: 'user_friends, user_photos, friends_photos'});
}

function startUI() {
    getFriends();
}

function getFriends() {
    console.log("getting friends");
    $('#login').hide();
    FB.api('/me/friends', function(response) {
        $.each(response.data, function(index, friend) {
            addFriend(friend.id, friend.name);
        });

        $('#content').show();
        $('#friend_list').chosen();
    });
}

function addFriend(id, name) {
    $('#friend_list')
        .append($("<option>")
        .attr("value", id)
        .text(name));
}

$('button#get_pictures').click(function(){
    var friendID = $('#friend_list').val();
    if(friendID) {
        getPhotos(friendID);
    }
});

function getPhotos(userID) {
    var num_photos = 0;
    var num_downloaded_photos = 0;
    var max_photos = 16;
    var unique_names = {};
    var zip = new JSZip();

    FB.api('/' + userID + '/photos', function(response) {
        traverse(response);
        console.log(response);
    });

    function traverse(obj) {
        if(obj.data.length) {
            $.get(obj.paging.next, function(data){
                traverse(data);
            });

            $.each(obj.data, function(index, data) {
                if(num_photos < max_photos) {
                    addPicture(data.picture);
                    downloadImage(data.images[0].source, data.created_time);
                    num_photos++;
                }
            });
        } else {
            // no data
        }
    }

    function addPicture(url) {
            if(num_photos % 4 === 0) {
                $('#pictures tbody:last')
                    .append($('<tr>'));
            }
            $('#pictures tr:last')
                .append($('<td>')
                    .append($('<img>', {'src': url})));
    }

    function downloadImage(url, time) {
        var file_name = getDateString(time);
        if(file_name in unique_names){
            unique_names[file_name]++;
            file_name += '(' + unique_names[file_name] + ')';
        } else {
            unique_names[file_name] = 0;
        }

        getImageData(url, function(image_data) {
            zip.file(file_name + '.jpg', image_data, {binary: true});
            num_downloaded_photos++;
            if(num_downloaded_photos === max_photos)
                createDownloadLink();
        });
    }

    function createDownloadLink() {
        var blobLink = document.getElementById('blob');
        console.log('finished downloading images!');
        try {
            blobLink.download = "images.zip";
            blobLink.href = window.URL.createObjectURL(zip.generate({type:"blob"}));
        } catch(e) {
            blobLink.innerHTML += " (not supported on this browser)";
        }
    }
}

function getImageData(url, callback){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
        if(this.status == 200){
            var blob = new Blob([this.response], {type: "image/jpg"});
            reader = new FileReader();
            reader.onload = function (event){
                if(event.loaded == event.total)
                    callback(event.target.result);
            }
            reader.readAsBinaryString(blob);
        }
    }
    xhr.send(null);
}

function getDateString(time_string) {
    var date = new Date(time_string);
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var year = date.getFullYear();
    var hour = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    return [year, month, day].join('-') + " " + [hour, minutes, seconds].join('.');
}
