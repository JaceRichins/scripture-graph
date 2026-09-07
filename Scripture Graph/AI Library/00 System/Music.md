---
ownership: system
mutable: human
content_type: reference
---

# Music

The Music shelf: the hymnbook, and playlists gathered by what they do for a
listener — hope, peace, courage, repentance, praise. Hymns play from the
Church's own recordings; everything else opens in Spotify, Apple Music or
YouTube. Titles and artists only — no words or music are stored here.

Edit the JSON to change a playlist. A track with `"a": "Hymn"` is looked up
in the hymnbook index by title; anything else is a search on the streaming
services. `cover` names a file in `covers/`.

```json
{
  "playlists": [
    {
      "key": "hope",
      "title": "Hope",
      "blurb": "For the morning after a hard night.",
      "cover": "music-hope",
      "tracks": [
        {"t": "Be Still, My Soul", "a": "Hymn"},
        {"t": "Come, Thou Fount of Every Blessing", "a": "Hymn"},
        {"t": "Lead, Kindly Light", "a": "Hymn"},
        {"t": "How Firm a Foundation", "a": "Hymn"},
        {"t": "The Lord Is My Light", "a": "Hymn"},
        {"t": "Standing on the Promises", "a": "Hymn"},
        {"t": "Here Is Hope", "a": "Rob Gardner"},
        {"t": "Great Is Thy Faithfulness", "a": "Chisholm & Runyan"},
        {"t": "Be Thou My Vision", "a": "Irish hymn"},
        {"t": "Living Hope", "a": "Phil Wickham"},
        {"t": "There Is a Balm in Gilead", "a": "Spiritual"},
        {"t": "The Lord Bless You and Keep You", "a": "John Rutter"}
      ]
    },
    {
      "key": "peace",
      "title": "Peace & Comfort",
      "blurb": "Quiet music for grief, worry and late nights.",
      "cover": "music-peace",
      "tracks": [
        {"t": "Where Can I Turn for Peace?", "a": "Hymn"},
        {"t": "Abide with Me; 'Tis Eventide", "a": "Hymn"},
        {"t": "Abide with Me!", "a": "Hymn"},
        {"t": "I Need Thee Every Hour", "a": "Hymn"},
        {"t": "It Is Well with My Soul", "a": "Hymn"},
        {"t": "Nearer, My God, to Thee", "a": "Hymn"},
        {"t": "His Eye Is on the Sparrow", "a": "Hymn"},
        {"t": "Consider the Lilies", "a": "Roger Hoffman"},
        {"t": "Precious Lord, Take My Hand", "a": "Thomas A. Dorsey"},
        {"t": "Jesu, Joy of Man's Desiring", "a": "J. S. Bach"},
        {"t": "Ave verum corpus", "a": "W. A. Mozart"},
        {"t": "Pie Jesu", "a": "Gabriel Fauré"},
        {"t": "Deep River", "a": "Spiritual"}
      ]
    },
    {
      "key": "courage",
      "title": "Courage & Motivation",
      "blurb": "For getting up, going out and pressing on.",
      "cover": "music-courage",
      "tracks": [
        {"t": "Come, Come, Ye Saints", "a": "Hymn"},
        {"t": "Press Forward, Saints", "a": "Hymn"},
        {"t": "Let Us All Press On", "a": "Hymn"},
        {"t": "Put Your Shoulder to the Wheel", "a": "Hymn"},
        {"t": "Called to Serve", "a": "Hymn"},
        {"t": "Go Forth with Faith", "a": "Hymn"},
        {"t": "Hope of Israel", "a": "Hymn"},
        {"t": "Carry On", "a": "Hymn"},
        {"t": "Faith in Every Footstep", "a": "Hymn"},
        {"t": "Onward, Christian Soldiers", "a": "Hymn"},
        {"t": "In Christ Alone", "a": "Keith Getty & Stuart Townend"},
        {"t": "Way Maker", "a": "Sinach"},
        {"t": "Total Praise", "a": "Richard Smallwood"}
      ]
    },
    {
      "key": "repentance",
      "title": "Repentance & Forgiveness",
      "blurb": "Music for turning back, and for being received.",
      "cover": "music-repentance",
      "tracks": [
        {"t": "I Stand All Amazed", "a": "Hymn"},
        {"t": "Come unto Jesus", "a": "Hymn"},
        {"t": "Savior, Redeemer of My Soul", "a": "Hymn"},
        {"t": "Softly and Tenderly Jesus Is Calling", "a": "Hymn"},
        {"t": "Amazing Grace", "a": "Hymn"},
        {"t": "More Holiness Give Me", "a": "Hymn"},
        {"t": "Be Thou Humble", "a": "Hymn"},
        {"t": "Reverently and Meekly Now", "a": "Hymn"},
        {"t": "Miserere mei, Deus", "a": "Gregorio Allegri"},
        {"t": "Amazing Grace (My Chains Are Gone)", "a": "Chris Tomlin"},
        {"t": "Lord, I Need You", "a": "Matt Maher"},
        {"t": "Agnus Dei", "a": "Samuel Barber"},
        {"t": "Come Home", "a": "Tyler Castleton"}
      ]
    },
    {
      "key": "gratitude",
      "title": "Gratitude & Praise",
      "blurb": "For counting blessings out loud.",
      "cover": "music-gratitude",
      "tracks": [
        {"t": "Count Your Blessings", "a": "Hymn"},
        {"t": "Because I Have Been Given Much", "a": "Hymn"},
        {"t": "For the Beauty of the Earth", "a": "Hymn"},
        {"t": "Now Thank We All Our God", "a": "Hymn"},
        {"t": "Praise to the Lord, the Almighty", "a": "Hymn"},
        {"t": "How Great Thou Art", "a": "Hymn"},
        {"t": "Prayer of Thanksgiving", "a": "Hymn"},
        {"t": "All Creatures of Our God and King", "a": "Hymn"},
        {"t": "10,000 Reasons (Bless the Lord)", "a": "Matt Redman"},
        {"t": "Goodness of God", "a": "Bethel Music"},
        {"t": "How Great Is Our God", "a": "Chris Tomlin"},
        {"t": "Gratitude", "a": "Brandon Lake"},
        {"t": "Hallelujah (Messiah)", "a": "G. F. Handel"}
      ]
    },
    {
      "key": "savior",
      "title": "The Savior",
      "blurb": "Songs about Jesus Christ, from every tradition that sings of Him.",
      "cover": "music-savior",
      "tracks": [
        {"t": "I Know That My Redeemer Lives", "a": "Hymn"},
        {"t": "I Believe in Christ", "a": "Hymn"},
        {"t": "Jesus, the Very Thought of Thee", "a": "Hymn"},
        {"t": "Our Savior's Love", "a": "Hymn"},
        {"t": "This Is the Christ", "a": "Hymn"},
        {"t": "Look unto Christ", "a": "Hymn"},
        {"t": "Behold the Wounds in Jesus' Hands", "a": "Hymn"},
        {"t": "Oh, the Deep, Deep Love of Jesus", "a": "Hymn"},
        {"t": "His Hands", "a": "Kenneth Cope"},
        {"t": "What a Beautiful Name", "a": "Hillsong Worship"},
        {"t": "O Divine Redeemer", "a": "Charles Gounod"},
        {"t": "Lamb of God", "a": "Rob Gardner"},
        {"t": "The Holy City", "a": "Stephen Adams"}
      ]
    },
    {
      "key": "sabbath",
      "title": "Sabbath & Worship",
      "blurb": "For Sunday mornings and the sacrament table.",
      "cover": "music-sabbath",
      "tracks": [
        {"t": "The Spirit of God", "a": "Hymn"},
        {"t": "Redeemer of Israel", "a": "Hymn"},
        {"t": "Sweet Is the Work", "a": "Hymn"},
        {"t": "High on the Mountain Top", "a": "Hymn"},
        {"t": "As Bread Is Broken", "a": "Hymn"},
        {"t": "Bread of Life, Living Water", "a": "Hymn"},
        {"t": "In Humility, Our Savior", "a": "Hymn"},
        {"t": "O God, the Eternal Father", "a": "Hymn"},
        {"t": "Sweet Hour of Prayer", "a": "Hymn"},
        {"t": "If Ye Love Me", "a": "Thomas Tallis"},
        {"t": "Locus iste", "a": "Anton Bruckner"},
        {"t": "Panis angelicus", "a": "César Franck"},
        {"t": "Ave Maria", "a": "Franz Schubert"}
      ]
    },
    {
      "key": "family",
      "title": "Home & Family",
      "blurb": "For the kitchen, the car and bedtime.",
      "cover": "music-family",
      "tracks": [
        {"t": "Love at Home", "a": "Hymn"},
        {"t": "Families Can Be Together Forever", "a": "Hymn"},
        {"t": "Home Can Be a Heaven on Earth", "a": "Hymn"},
        {"t": "I Am a Child of God", "a": "Hymn"},
        {"t": "Each Life That Touches Ours for Good", "a": "Hymn"},
        {"t": "Love One Another", "a": "Hymn"},
        {"t": "Holding Hands Around the World", "a": "Hymn"},
        {"t": "Welcome Home", "a": "Hymn"},
        {"t": "God Be with You Till We Meet Again", "a": "Hymn"},
        {"t": "A Child's Prayer", "a": "Janice Kapp Perry"},
        {"t": "I Feel My Savior's Love", "a": "Children's Songbook"},
        {"t": "Homeward Bound", "a": "Marta Keen"},
        {"t": "The Prayer", "a": "David Foster & Carole Bayer Sager"}
      ]
    },
    {
      "key": "christmas",
      "title": "Christmas",
      "blurb": "The nativity, sung.",
      "cover": "music-christmas",
      "tracks": [
        {"t": "Silent Night", "a": "Hymn"},
        {"t": "Joy to the World", "a": "Hymn"},
        {"t": "O Little Town of Bethlehem", "a": "Hymn"},
        {"t": "Far, Far Away on Judea's Plains", "a": "Hymn"},
        {"t": "Away in a Manger", "a": "Hymn"},
        {"t": "Hark! The Herald Angels Sing", "a": "Hymn"},
        {"t": "Oh, Come, All Ye Faithful", "a": "Hymn"},
        {"t": "With Wondering Awe", "a": "Hymn"},
        {"t": "He Is Born, the Divine Christ Child", "a": "Hymn"},
        {"t": "Still, Still, Still", "a": "Hymn"},
        {"t": "What Child Is This?", "a": "Hymn"},
        {"t": "O Holy Night", "a": "Adolphe Adam"},
        {"t": "O Come, O Come, Emmanuel", "a": "Plainsong"},
        {"t": "In the Bleak Midwinter", "a": "Gustav Holst"},
        {"t": "Mary, Did You Know?", "a": "Mark Lowry & Buddy Greene"},
        {"t": "Breath of Heaven (Mary's Song)", "a": "Amy Grant"}
      ]
    },
    {
      "key": "easter",
      "title": "Easter",
      "blurb": "Gethsemane, the cross, the empty tomb.",
      "cover": "music-easter",
      "tracks": [
        {"t": "Gethsemane", "a": "Hymn"},
        {"t": "There Is a Green Hill Far Away", "a": "Hymn"},
        {"t": "Behold the Great Redeemer Die", "a": "Hymn"},
        {"t": "Upon the Cross of Calvary", "a": "Hymn"},
        {"t": "He Is Risen!", "a": "Hymn"},
        {"t": "Christ the Lord Is Risen Today", "a": "Hymn"},
        {"t": "That Easter Morn", "a": "Hymn"},
        {"t": "My Redeemer Lives", "a": "Hymn"},
        {"t": "Hail the Day That Sees Him Rise", "a": "Hymn"},
        {"t": "Were You There?", "a": "Spiritual"},
        {"t": "I Know That My Redeemer Liveth", "a": "G. F. Handel"},
        {"t": "Because He Lives", "a": "Bill & Gloria Gaither"},
        {"t": "Easter Hymn (Cavalleria rusticana)", "a": "Pietro Mascagni"}
      ]
    }
  ]
}
```
