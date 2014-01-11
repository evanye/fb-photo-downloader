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
            console.log("disconnected");
            resetUI();
        }

    });

    enable('button#login');
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
    hide('div.login-box');
    show('.container');

    $('#reportrange').daterangepicker(
        {
          ranges: {
             'Today': [moment(), moment()],
             'Yesterday': [moment().subtract('days', 1), moment().subtract('days', 1)],
             'Last 7 Days': [moment().subtract('days', 6), moment()],
             'Last 30 Days': [moment().subtract('days', 29), moment()],
             'Last 3 Months': [moment().subtract('months', 3), moment()],
             'Last 6 Months': [moment().subtract('months', 6), moment()],
             'All Time': [moment(0), moment()]
          },
          startDate: moment().subtract('days', 29),
          endDate: moment()
        },
        function(start, end) {
            start_date = (start.unix() < 0) ? moment(0) : start;
            end_date = end;
            $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
            resetButtons();
        }
    );
    $('#reportrange span').html(moment().subtract('days', 29).format('MMMM D, YYYY') + ' - ' + moment().format('MMMM D, YYYY'));
}

function resetUI(){
    resetButtons();
    hide('.container');
    show('.panel');
}

function getFriends() {
    console.log("getting friends");
    var options = $('#friend-list').get(0).options;
    options.length = 0;
    options.add(new Option());

    FB.api('/me', function(response) {
        options.add(new Option(response.name + ' ( Me )', response.id), 0);
    });

    FB.api('/me/friends', function(response) {
        $.each(response.data, function(index, friend) {
            options.add(new Option(friend.name, friend.id));
        });
        
        $('#friend-list').chosen().change(function(){
            resetButtons();
        });
        enable('button#get-pictures');
    });
}

$('button#get-pictures').click(function(){
    var friendID = $('#friend-list').val();
    if(friendID) {
        $('div.photo').remove();
        getPhotos(friendID, start_date, end_date);
        hide('#no-photos-warning');
        disable('button#get-pictures');
        $('button#get-pictures').text('Getting Pics');
        show('#facebookG');
    }
});

function getPhotos(userID, start, end) {
    var thumbnail_queue = [];
    var download_queue = [];
    var got_all_pictures = false;

    FB.api('/' + userID + '/photos?since=' + start.unix() + 
            '&until=' + end.add('days', 1).unix(), function(response) {
        if(response.data.length) {
            traverse(response);
        } else { //no data
            show('#no-photos-warning');
        }
    });

    function traverse(obj) {
        if(obj.data.length === 0) {
            setUpDownload();
            return;
        }

        var i = 0;
        var cur_date = obj.data[0].created_time;

        while(i < obj.data.length && moment(cur_date) >= start){
            var data = obj.data[i]; i++;
            cur_date = data.created_time;

            thumbnail_queue.push(makeThumbnail(data.picture));
            download_queue.push({
                url: data.images[0].source,
                time: cur_date
            });
        }
        loadThumbnails();

        if(moment(cur_date) >= start) {
            $.get(obj.paging.next, function(data){
                traverse(data);
            });
        } else {
            setUpDownload();
        }
    }

    $(window).scroll(function() {
        loadThumbnails();
    });

    function makeThumbnail(url) {
        return "<div class='photo' " + 
               "style='background-image: url(" + url + ");'" +
               "></div>";
    }

    function loadThumbnails() {
        if(isScrolledIntoView('#facebookG')) {
            var html_text = [];
            var batch_size = getPhotoBatchSize();
            while(thumbnail_queue.length > 0 && html_text.length < batch_size)
                html_text.push(thumbnail_queue.shift());
            $('#pictures').append($(html_text.join('')));

            if(got_all_pictures && $('div.photo').size() === download_queue.length) {
                hide('#facebookG');
                $(window).off('scroll');
            }
        }
    }

    function setUpDownload(){
        got_all_pictures = true;
        hide('button#get-pictures');
        show('button#download');
        $('button#download').click(function(){
            if(download_queue.length) {
                downloadImages(download_queue);
                disable('button#download');
                $('button#download').text('Downloading');
                show('.progress');
            }
        });
    }
}

function downloadImages(queue){
    var num_downloaded_photos = 0;
    var unique_names = {};
    var zip = new JSZip();

    $.each(queue, function(index, image){
        var file_name = getDateString(image.time);
        if(file_name in unique_names){
            unique_names[file_name]++;
            file_name += '(' + unique_names[file_name] + ')';
        } else {
            unique_names[file_name] = 0;
        }

        getImageData(image.url, function(image_data) {
            zip.file(file_name + '.jpg', image_data, {binary: true});
            num_downloaded_photos++;
            setProgressBar(Math.floor(num_downloaded_photos * 100 / queue.length));
            if(num_downloaded_photos === queue.length)
                createDownloadLink(zip);
        });
    });
}

function createDownloadLink(zip) {
    var blobLink = document.getElementById('blob');
    hide('button#download');
    show(blobLink);
    console.log('finished downloading images!');
    try {
        blobLink.download = getSelectedName() + ".zip";
        blobLink.href = window.URL.createObjectURL(zip.generate({type:"blob"}));
    } catch(e) {
        blobLink.innerHTML += " (not supported on this browser)";
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

function resetButtons() {
    $('button#get-pictures').text('Get Pictures');
    enable('button#get-pictures');
    show('button#get-pictures');

    $('button#download').text('Download');
    enable('button#download');
    hide('button#download');

    hide('a#blob');

    setProgressBar(0);
    hide('.progress');
}

function getSelectedName(){
    var name = $('#friend-list option:selected').text();
    if(name.indexOf('(') !== -1) {
        return name.slice(0, name.indexOf('(') - 1);
    }
    return name;
}

function getDateString(time_string) {
    return moment(time_string).format('YYYY-MM-DD HH.mm.ss')
}

function isScrolledIntoView(elem) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();

    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

function getPhotoBatchSize() {
    return Math.floor($('#pictures').width() / 122)
           * Math.ceil($(window).height() / 122);
}

function setProgressBar(percentage) {
    $('#progressbar').width(percentage + '%');    
}

function show(elem) {
    $(elem).removeClass('hidden');
}

function hide(elem) {
    $(elem).addClass('hidden');
}

function enable(elem) {
    $(elem).removeClass('disabled');
}

function disable(elem) {
    $(elem).addClass('disabled');
}