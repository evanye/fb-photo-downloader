$('#login').click(function(){
    FB.login(function(response){
        console.log("logged in");
    }, {scope: 'user_friends, user_photos, friends_photos'});
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
            startUI();
        } else /* if (response.status === 'not_authorized') */ {
            console.log("authorization failed");
        }

    });

    $('button#login').removeClass('disabled');
};

function logout() {
    FB.logout(function(response) {
        console.log('logout');
    });
}

var start_date = moment().subtract('days', 29);
var end_date = moment();

function startUI() {
    getFriends();
    $('div.login-box').hide();
    $('.container').show();

    $('#reportrange').daterangepicker(
        {
          ranges: {
             'Today': [moment(), moment()],
             'Yesterday': [moment().subtract('days', 1), moment().subtract('days', 1)],
             'Last 7 Days': [moment().subtract('days', 6), moment()],
             'Last 30 Days': [moment().subtract('days', 29), moment()],
             'This Month': [moment().startOf('month'), moment().endOf('month')],
             'All Time': [moment(0), moment()]
          },
          startDate: moment().subtract('days', 29),
          endDate: moment()
        },
        function(start, end) {
            start_date = (start.unix() < 0) ? moment(0) : start;
            end_date = end;
            $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
        }
    );
    $('#reportrange span').html(moment().subtract('days', 29).format('MMMM D, YYYY') + ' - ' + moment().format('MMMM D, YYYY'));
}

function getFriends() {
    console.log("getting friends");
    var options = $('#friend_list').get(0).options;
    options.length = 0;
    options.add(new Option());

    FB.api('/me', function(response) {
        options.add(new Option(response.name + ' ( Me )', response.id), 0);
    });

    FB.api('/me/friends', function(response) {
        $.each(response.data, function(index, friend) {
            options.add(new Option(friend.name, friend.id));
        });
        
        $('#friend_list').chosen();
        $('button#get_pictures').removeClass('disabled');
    });
}

$('button#get_pictures').click(function(){
    var friendID = $('#friend_list').val();
    if(friendID) {
        getPhotos(friendID, start_date, end_date);
    }
});

function getPhotos(userID, start, end) {
    var num_photos = 0;
    var num_downloaded_photos = 0;
    var still_looking = true;
    var max_photos = 100;
    var unique_names = {};
    var zip = new JSZip();

    FB.api('/' + userID + '/photos?since=' + start.unix() + '&until=' + end.unix(), function(response) {
        traverse(response);
        console.log(response);
    });

    function traverse(obj) {
        if(obj.data.length) {
            $.each(obj.data, function(index, data) {
                if(num_photos >= max_photos || moment(data.created_time) < start){
                    still_looking = false;
                    return;
                }
                addPicture(data.picture);
                downloadImage(data.images[0].source, data.created_time);
                num_photos++;
            });

            if(still_looking) {
                $.get(obj.paging.next, function(data){
                    traverse(data);
                });
            }
        }
    }

    function addPicture(url) {
        if(num_photos % 4 === 0) {
            $('#pictures tbody:last')
                .append($('<tr>'));
        }
        var div = "<div class='photo' " + 
                  "style='background-image: url(" + url + ");'" +
                  "></div>";
        $('#pictures tr:last')
            .append($('<td>')
                .append($(div)));
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
            blobLink.download = getSelectedName() + ".zip";
            blobLink.href = window.URL.createObjectURL(zip.generate({type:"blob"}));
        } catch(e) {
            blobLink.innerHTML += " (not supported on this browser)";
        }
    }
}

function getSelectedName(){
    var name = $('#friend_list option:selected').text();
    if(s.indexOf('(') !== -1) {
        return name.slice(0, s.indexOf('(') - 1);
    }
    return name;
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
    // var date = new Date(time_string);
    // var day = date.getDate();
    // var month = date.getMonth() + 1;
    // var year = date.getFullYear();
    // var hour = date.getHours();
    // var minutes = date.getMinutes();
    // var seconds = date.getSeconds();
    // return [year, month, day].join('-') + " " + [hour, minutes, seconds].join('.');
    return moment(time_string).format('YYYY-MM-DD HH.mm.ss')
}
