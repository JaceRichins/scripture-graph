---
ownership: system
mutable: human
content_type: reference
---

# Music

The Music shelf: both hymnbooks, the Children's Songbook, and playlists
gathered by what they do for a listener. Hymns and Primary songs play from
the Church's own recordings; everything else opens in the listener's music
app (Spotify, Apple Music or YouTube). Titles and artists only — no words
or music are stored here.

Edit the JSON to change a playlist. A track with `"a": "Hymn"` or
`"a": "Primary"` is looked up in the Church index by title; anything else is
a search in the music app. `cover` names a file in `covers/`.

```json
{
  "playlists": [
    {
      "key": "hope",
      "title": "Hope",
      "blurb": "For the morning after a hard night.",
      "cover": "music-hope",
      "tracks": [
        {
          "t": "Be Still, My Soul",
          "a": "Hymn",
          "yt": "cHNT6G9ZKik"
        },
        {
          "t": "Come, Thou Fount of Every Blessing",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn",
          "yt": "fCbZJwhpTmo"
        },
        {
          "t": "How Firm a Foundation",
          "a": "Hymn",
          "yt": "r0Xvr8maR34"
        },
        {
          "t": "The Lord Is My Light",
          "a": "Hymn",
          "yt": "8D5Tu9ZbvAQ"
        },
        {
          "t": "Standing on the Promises",
          "a": "Hymn",
          "yt": "dJyuZDUy--M"
        },
        {
          "t": "Come unto Him",
          "a": "Hymn",
          "yt": "65ZbRiZqG1M"
        },
        {
          "t": "Where Can I Turn for Peace?",
          "a": "Hymn",
          "yt": "XJvZFUZ-c0I"
        },
        {
          "t": "God Is Love",
          "a": "Hymn",
          "yt": "EXcFR5YCrj4"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Redeemer of Israel",
          "a": "Hymn",
          "yt": "Kw2cTPf8QFQ"
        },
        {
          "t": "Anytime, Anywhere",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "I Know My Father Lives",
          "a": "Primary",
          "yt": "h_k9FNS-Vdc"
        },
        {
          "t": "Here Is Hope",
          "a": "Rob Gardner",
          "yt": "EpgStSFrFjw"
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan",
          "yt": "mMEgkCbCTGo"
        },
        {
          "t": "Be Thou My Vision",
          "a": "Irish hymn",
          "yt": "ihJAJA4ibEs"
        },
        {
          "t": "Living Hope",
          "a": "Phil Wickham",
          "yt": "u-1fwZtKJSM"
        },
        {
          "t": "There Is a Balm in Gilead",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3b/A_balm_in_Gilead_-_Vale_Of_Towey_Male_Voice_Choir.ogg/A_balm_in_Gilead_-_Vale_Of_Towey_Male_Voice_Choir.ogg.mp3",
          "credit": "A balm in Gilead - Vale Of Towey Male Voice Choir.ogg (cc by-sa 3.0)",
          "yt": "NjW0VleQFxk"
        },
        {
          "t": "The Lord Bless You and Keep You",
          "a": "John Rutter",
          "yt": "QcYzO8Y4PH0"
        },
        {
          "t": "You Say",
          "a": "Lauren Daigle",
          "yt": "sIaT8Jl2zpI"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen",
          "yt": "YQTGIGZY7Yg"
        },
        {
          "t": "It Is Well",
          "a": "Bethel Music",
          "yt": "T0dIWJ4t4Jg"
        },
        {
          "t": "Cornerstone",
          "a": "Hillsong Worship",
          "yt": "izrk-erhDdk"
        },
        {
          "t": "Hope Has a Name",
          "a": "River Valley Worship",
          "yt": "ezowVsEa9ac"
        }
      ]
    },
    {
      "key": "peace",
      "title": "Peace & Comfort",
      "blurb": "Quiet music for grief, worry and late nights.",
      "cover": "music-peace",
      "tracks": [
        {
          "t": "Where Can I Turn for Peace?",
          "a": "Hymn",
          "yt": "XJvZFUZ-c0I"
        },
        {
          "t": "Abide with Me; 'Tis Eventide",
          "a": "Hymn",
          "yt": "Q_F0mWGTN04"
        },
        {
          "t": "Abide with Me!",
          "a": "Hymn",
          "yt": "YvZsOTJEUUc"
        },
        {
          "t": "I Need Thee Every Hour",
          "a": "Hymn",
          "yt": "PPEdmbgga_o"
        },
        {
          "t": "It Is Well with My Soul",
          "a": "Hymn",
          "yt": "Eg5O2y1UXw4"
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn",
          "yt": "xaxrY1rxZKE"
        },
        {
          "t": "His Eye Is on the Sparrow",
          "a": "Hymn",
          "yt": "6ha9a9YF3UI"
        },
        {
          "t": "Be Still, My Soul",
          "a": "Hymn",
          "yt": "cHNT6G9ZKik"
        },
        {
          "t": "Master, the Tempest Is Raging",
          "a": "Hymn",
          "yt": "Ef2xgL45qX4"
        },
        {
          "t": "Jesus, Lover of My Soul",
          "a": "Hymn",
          "yt": "Eg5O2y1UXw4"
        },
        {
          "t": "Rock of Ages",
          "a": "Hymn",
          "yt": "GAfAko5dwoM"
        },
        {
          "t": "Softly Now the Light of Day",
          "a": "Hymn",
          "yt": "rdUV8xIcfnY"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary",
          "yt": "MAUr-clpihg"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman",
          "yt": "ilEed_1B0dk"
        },
        {
          "t": "Precious Lord, Take My Hand",
          "a": "Thomas A. Dorsey",
          "yt": "fRGTR_wUje8"
        },
        {
          "t": "Jesu, Joy of Man's Desiring",
          "a": "J. S. Bach",
          "url": "https://upload.wikimedia.org/wikipedia/commons/5/51/Jesu%2C_Joy_of_Man%27s_Desiring_%28ISRC_USUAN1100189%29.mp3?utm_source=commons.wikimedia.org&utm_campaign=api&utm_content=original",
          "credit": "Jesu, Joy of Man's Desiring (ISRC USUAN1100189).mp3 (cc by 3.0)",
          "yt": "oduhc96kTlw"
        },
        {
          "t": "Ave verum corpus",
          "a": "W. A. Mozart",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/Ave_Verum_Corpus_-_Rhymney_Millennium_Chorale.ogg/Ave_Verum_Corpus_-_Rhymney_Millennium_Chorale.ogg.mp3",
          "credit": "Ave Verum Corpus - Rhymney Millennium Chorale.ogg (cc by-sa 3.0)",
          "yt": "IluDMs8nBYc"
        },
        {
          "t": "Pie Jesu",
          "a": "Gabriel Fauré",
          "url": "",
          "yt": "oduhc96kTlw"
        },
        {
          "t": "Deep River",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/Deep_River_-_Alun_Jones.ogg/Deep_River_-_Alun_Jones.ogg.mp3",
          "credit": "Deep River - Alun Jones.ogg (cc by-sa 3.0)",
          "yt": "LiIURFm63Yk"
        },
        {
          "t": "Peace Like a River",
          "a": "Spiritual",
          "url": "",
          "yt": "M8of9CQ9Fes"
        },
        {
          "t": "Still",
          "a": "Hillsong Worship",
          "yt": "lAdwX8HypJM"
        },
        {
          "t": "The Lord Is My Shepherd",
          "a": "Howard Goodall",
          "yt": "EViB5epHMn8"
        },
        {
          "t": "Sleep",
          "a": "Eric Whitacre",
          "yt": "Yw5gupbe9E0"
        },
        {
          "t": "Lux aurumque",
          "a": "Eric Whitacre",
          "yt": "e6HVCqQStRE"
        }
      ]
    },
    {
      "key": "courage",
      "title": "Courage & Motivation",
      "blurb": "For getting up, going out and pressing on.",
      "cover": "music-courage",
      "tracks": [
        {
          "t": "Come, Come, Ye Saints",
          "a": "Hymn",
          "yt": "4ia3gYSvG8M"
        },
        {
          "t": "Press Forward, Saints",
          "a": "Hymn",
          "yt": "08-GoRqECHk"
        },
        {
          "t": "Let Us All Press On",
          "a": "Hymn",
          "yt": "a2qPlvxuCLg"
        },
        {
          "t": "Put Your Shoulder to the Wheel",
          "a": "Hymn",
          "yt": "hvAbelJn4xI"
        },
        {
          "t": "Called to Serve",
          "a": "Hymn",
          "yt": "H9OqRPEWdcA"
        },
        {
          "t": "Go Forth with Faith",
          "a": "Hymn",
          "yt": "uxuLFgajZ04"
        },
        {
          "t": "Hope of Israel",
          "a": "Hymn",
          "yt": "N5iwFMaK0T0"
        },
        {
          "t": "Carry On",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "Faith in Every Footstep",
          "a": "Hymn",
          "yt": "6jH4mOEDu5w"
        },
        {
          "t": "Onward, Christian Soldiers",
          "a": "Hymn",
          "yt": "DPscLRj8z-I"
        },
        {
          "t": "Do What Is Right",
          "a": "Hymn",
          "yt": "bVWPSjlwhZg"
        },
        {
          "t": "Choose the Right",
          "a": "Hymn",
          "yt": "rfu-MgXTDcM"
        },
        {
          "t": "True to the Faith",
          "a": "Hymn",
          "yt": "AN1L2ZABMuQ"
        },
        {
          "t": "Ye Elders of Israel (Men)",
          "a": "Hymn",
          "yt": "BMx57Juey8g"
        },
        {
          "t": "Nephi's Courage",
          "a": "Primary",
          "yt": "xGFuPbuHRBY"
        },
        {
          "t": "I Will Be Valiant",
          "a": "Primary",
          "yt": "ALvBRbu2mzQ"
        },
        {
          "t": "In Christ Alone",
          "a": "Keith Getty & Stuart Townend",
          "yt": "m_063OI38RQ"
        },
        {
          "t": "Way Maker",
          "a": "Sinach",
          "yt": "w2pHOVKP7xo"
        },
        {
          "t": "Total Praise",
          "a": "Richard Smallwood",
          "yt": "jCjaUwEsMdQ"
        },
        {
          "t": "Rise Up (Lazarus)",
          "a": "CAIN",
          "yt": "8RIZlNYl4ok"
        },
        {
          "t": "Battle Belongs",
          "a": "Phil Wickham",
          "yt": "qtvQNzPHn-w"
        },
        {
          "t": "Raise a Hallelujah",
          "a": "Bethel Music",
          "yt": "G2XtRuPfaAU"
        },
        {
          "t": "Soldiers of Christ, Arise",
          "a": "Charles Wesley",
          "url": "",
          "yt": "LtgKoJ5hoZw"
        },
        {
          "t": "Zadok the Priest",
          "a": "G. F. Handel",
          "url": "",
          "yt": "6t0KD4AzO5w"
        }
      ]
    },
    {
      "key": "repentance",
      "title": "Repentance & Forgiveness",
      "blurb": "Music for turning back, and for being received.",
      "cover": "music-repentance",
      "tracks": [
        {
          "t": "I Stand All Amazed",
          "a": "Hymn",
          "yt": "xQ-xbrgzKB4"
        },
        {
          "t": "Come unto Jesus",
          "a": "Hymn",
          "yt": "65ZbRiZqG1M"
        },
        {
          "t": "Savior, Redeemer of My Soul",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Softly and Tenderly Jesus Is Calling",
          "a": "Hymn",
          "yt": "H-3JySkGz3o"
        },
        {
          "t": "Amazing Grace",
          "a": "Hymn",
          "yt": "C2arm5ydeJc"
        },
        {
          "t": "More Holiness Give Me",
          "a": "Hymn",
          "yt": "vI6QWuIvMvE"
        },
        {
          "t": "Be Thou Humble",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Reverently and Meekly Now",
          "a": "Hymn",
          "yt": "cHNT6G9ZKik"
        },
        {
          "t": "Jesus, Savior, Pilot Me",
          "a": "Hymn",
          "yt": "pBUcv33qhN8"
        },
        {
          "t": "Lord, I Would Follow Thee",
          "a": "Hymn",
          "yt": "TE1vWJFX-jo"
        },
        {
          "t": "O Savior, Thou Who Wearest a Crown",
          "a": "Hymn",
          "yt": "UJggXsCiBos"
        },
        {
          "t": "Help Me, Dear Father",
          "a": "Primary",
          "yt": "bse5TtEuaGk"
        },
        {
          "t": "Miserere mei, Deus",
          "a": "Gregorio Allegri",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d7/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg.mp3",
          "credit": "Allegri - Miserere Mei, Deus - Ensamble Escénico Vocal (audio).ogg (cc by 3.0)",
          "yt": "aQ78UKW63Sw"
        },
        {
          "t": "Amazing Grace (My Chains Are Gone)",
          "a": "Chris Tomlin",
          "yt": "Y-4NFvI5U9w"
        },
        {
          "t": "Lord, I Need You",
          "a": "Matt Maher",
          "yt": "LuvfMDhTyMA"
        },
        {
          "t": "Agnus Dei",
          "a": "Samuel Barber",
          "yt": "fRL447oDId4"
        },
        {
          "t": "Come Home",
          "a": "Tyler Castleton",
          "yt": "kZH_QNjE46s"
        },
        {
          "t": "O Come to the Altar",
          "a": "Elevation Worship",
          "yt": "rYQ5yXCc_CA"
        },
        {
          "t": "Nothing but the Blood",
          "a": "Robert Lowry",
          "url": "",
          "yt": "zermECP19JQ"
        },
        {
          "t": "Just As I Am",
          "a": "Charlotte Elliott",
          "url": "",
          "yt": "30EPFHhBSZE"
        },
        {
          "t": "Kyrie (Mass in B minor)",
          "a": "J. S. Bach",
          "url": "",
          "yt": "SxwaztIZ6tA"
        },
        {
          "t": "The Prodigal",
          "a": "Sovereign Grace Music",
          "yt": "t0WDY1UHUIo"
        }
      ]
    },
    {
      "key": "gratitude",
      "title": "Gratitude & Praise",
      "blurb": "For counting blessings out loud.",
      "cover": "music-gratitude",
      "tracks": [
        {
          "t": "Count Your Blessings",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Because I Have Been Given Much",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "For the Beauty of the Earth",
          "a": "Hymn",
          "yt": "3pO7MIiICG0"
        },
        {
          "t": "Now Thank We All Our God",
          "a": "Hymn",
          "yt": "K7gMDXylzW8"
        },
        {
          "t": "Praise to the Lord, the Almighty",
          "a": "Hymn",
          "yt": "3NNatbKemz0"
        },
        {
          "t": "How Great Thou Art",
          "a": "Hymn",
          "yt": "LMIroXZ1HpY"
        },
        {
          "t": "Prayer of Thanksgiving",
          "a": "Hymn",
          "yt": "4NY9faeavko"
        },
        {
          "t": "All Creatures of Our God and King",
          "a": "Hymn",
          "yt": "nAXv8mGM4cQ"
        },
        {
          "t": "Praise God, from Whom All Blessings Flow",
          "a": "Hymn",
          "yt": "hYmSSGm02xo"
        },
        {
          "t": "Come, Ye Thankful People",
          "a": "Hymn",
          "yt": "msOzJ6DY7EA"
        },
        {
          "t": "Glory to God on High",
          "a": "Hymn",
          "yt": "D3cCV0CLLGY"
        },
        {
          "t": "My Heavenly Father Loves Me",
          "a": "Primary",
          "yt": "7XSE63QIc7I"
        },
        {
          "t": "Thanks to Our Father",
          "a": "Primary",
          "yt": "MZdG4G6Cqm8"
        },
        {
          "t": "10,000 Reasons (Bless the Lord)",
          "a": "Matt Redman",
          "yt": "XtwIT8JjddM"
        },
        {
          "t": "Goodness of God",
          "a": "Bethel Music",
          "yt": "-f4MUUMWMV4"
        },
        {
          "t": "How Great Is Our God",
          "a": "Chris Tomlin",
          "yt": "KBD18rsVJHk"
        },
        {
          "t": "Gratitude",
          "a": "Brandon Lake",
          "yt": "dQdfs5S6jyA"
        },
        {
          "t": "Hallelujah (Messiah)",
          "a": "G. F. Handel",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3f/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg.mp3",
          "credit": "Handel Messiah Hallelujah by Oratorio Chorus.ogg (public domain)",
          "yt": "BBZ7AfZR9xs"
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan",
          "yt": "mMEgkCbCTGo"
        },
        {
          "t": "Holy, Holy, Holy",
          "a": "Reginald Heber",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2f/Byrd_4-Part_Mass_-_Sanctus.ogg/Byrd_4-Part_Mass_-_Sanctus.ogg.mp3",
          "credit": "Byrd 4-Part Mass - Sanctus.ogg (cc by 3.0)",
          "yt": "2qCmtUhiKcA"
        },
        {
          "t": "Gloria (Vivaldi)",
          "a": "Antonio Vivaldi",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fc/Vivaldi_Gloriapatri_DixitDominus_RV807_Esmuc.ogg/Vivaldi_Gloriapatri_DixitDominus_RV807_Esmuc.ogg.mp3",
          "credit": "Vivaldi Gloriapatri DixitDominus RV807 Esmuc.ogg (cc by-sa 4.0)",
          "yt": "8ztlrVUMH3A"
        },
        {
          "t": "Thank You Lord",
          "a": "Chris Tomlin",
          "yt": "xOgAmQvOUM0"
        }
      ]
    },
    {
      "key": "savior",
      "title": "The Savior",
      "blurb": "Songs about Jesus Christ, from every tradition that sings of Him.",
      "cover": "music-savior",
      "tracks": [
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "I Believe in Christ",
          "a": "Hymn",
          "yt": "RcGFkzBJ_1o"
        },
        {
          "t": "Jesus, the Very Thought of Thee",
          "a": "Hymn",
          "yt": "f2FH7vxAoH8"
        },
        {
          "t": "Our Savior's Love",
          "a": "Hymn",
          "yt": "D8beEeoHvTQ"
        },
        {
          "t": "This Is the Christ",
          "a": "Hymn",
          "yt": "bVWPSjlwhZg"
        },
        {
          "t": "Look unto Christ",
          "a": "Hymn",
          "yt": "yAjcXW0FFmk"
        },
        {
          "t": "Behold the Wounds in Jesus' Hands",
          "a": "Hymn",
          "yt": "b9SSGNpQ_IQ"
        },
        {
          "t": "Oh, the Deep, Deep Love of Jesus",
          "a": "Hymn",
          "yt": "6ha9a9YF3UI"
        },
        {
          "t": "Jesus, Once of Humble Birth",
          "a": "Hymn",
          "yt": "NOpgkAKB3Tk"
        },
        {
          "t": "Jesus of Nazareth, Savior and King",
          "a": "Hymn",
          "yt": "D8beEeoHvTQ"
        },
        {
          "t": "Precious Savior, Dear Redeemer",
          "a": "Hymn",
          "yt": "p9-vkHppCpA"
        },
        {
          "t": "Beautiful Savior (Crusader's Hymn)",
          "a": "Primary",
          "yt": "3WhTfEYmfcM"
        },
        {
          "t": "He Sent His Son",
          "a": "Primary",
          "yt": "LcBZjGqf8yo"
        },
        {
          "t": "Jesus Once Was a Little Child",
          "a": "Primary",
          "yt": "hd2LruXdl0Q"
        },
        {
          "t": "His Hands",
          "a": "Kenneth Cope",
          "yt": "qbjgqz3vqew"
        },
        {
          "t": "What a Beautiful Name",
          "a": "Hillsong Worship",
          "yt": "nQWFzMvCfLE"
        },
        {
          "t": "O Divine Redeemer",
          "a": "Charles Gounod",
          "url": "",
          "yt": "tQPC-SX-Rvw"
        },
        {
          "t": "Lamb of God",
          "a": "Rob Gardner",
          "yt": "mQxLts7iWXQ"
        },
        {
          "t": "The Holy City",
          "a": "Stephen Adams",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cf/The_Blue_Alsatian_Mountains_by_Michael_Maybrick.ogg/The_Blue_Alsatian_Mountains_by_Michael_Maybrick.ogg.mp3",
          "credit": "The Blue Alsatian Mountains by Michael Maybrick.ogg (public domain)",
          "yt": "5PAc3krFyQA"
        },
        {
          "t": "Jesus Paid It All",
          "a": "Kristian Stanfill",
          "yt": "1Vp2O3YqeJQ"
        },
        {
          "t": "King of Kings",
          "a": "Hillsong Worship",
          "yt": "dQl4izxPeNU"
        },
        {
          "t": "Fairest Lord Jesus",
          "a": "Silesian folk hymn",
          "url": "",
          "yt": "3WhTfEYmfcM"
        },
        {
          "t": "Crown Him with Many Crowns",
          "a": "Matthew Bridges",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/80/Crown_Him_with_many_Crowns.ogg/Crown_Him_with_many_Crowns.ogg.mp3",
          "credit": "Crown Him with many Crowns.ogg (cc by 3.0)",
          "yt": "vyW5rEP7b3Q"
        },
        {
          "t": "Jesus, Joy of Loving Hearts",
          "a": "Bernard of Clairvaux",
          "url": "",
          "yt": "oduhc96kTlw"
        }
      ]
    },
    {
      "key": "sabbath",
      "title": "Sabbath & Worship",
      "blurb": "For Sunday mornings and the sacrament table.",
      "cover": "music-sabbath",
      "tracks": [
        {
          "t": "The Spirit of God",
          "a": "Hymn",
          "yt": "608cbv7Qe_A"
        },
        {
          "t": "Redeemer of Israel",
          "a": "Hymn",
          "yt": "Kw2cTPf8QFQ"
        },
        {
          "t": "Sweet Is the Work",
          "a": "Hymn",
          "yt": "7Alo2NXK2aw"
        },
        {
          "t": "High on the Mountain Top",
          "a": "Hymn",
          "yt": "ee9u577klxY"
        },
        {
          "t": "As Bread Is Broken",
          "a": "Hymn",
          "yt": "yggEbejfYSY"
        },
        {
          "t": "Bread of Life, Living Water",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "In Humility, Our Savior",
          "a": "Hymn",
          "yt": "D8beEeoHvTQ"
        },
        {
          "t": "O God, the Eternal Father",
          "a": "Hymn",
          "yt": "hYmSSGm02xo"
        },
        {
          "t": "Sweet Hour of Prayer",
          "a": "Hymn",
          "yt": "CdxQbxpRl9Y"
        },
        {
          "t": "God, Our Father, Hear Us Pray",
          "a": "Hymn",
          "yt": "CdxQbxpRl9Y"
        },
        {
          "t": "While of These Emblems We Partake",
          "a": "Hymn",
          "yt": "dqEqxwdGEAE"
        },
        {
          "t": "As I Keep the Sabbath Day",
          "a": "Hymn",
          "yt": "MaQYQnrPgSM"
        },
        {
          "t": "Reverence Is Love",
          "a": "Primary",
          "yt": "H-3JySkGz3o"
        },
        {
          "t": "If Ye Love Me",
          "a": "Thomas Tallis",
          "url": "",
          "yt": "gm8V_eY18fU"
        },
        {
          "t": "Locus iste",
          "a": "Anton Bruckner",
          "url": "",
          "yt": "UY56UVgsXF0"
        },
        {
          "t": "Panis angelicus",
          "a": "César Franck",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Panis_Angelicus_-_Llanelli_Male_Voice_Choir.ogg/Panis_Angelicus_-_Llanelli_Male_Voice_Choir.ogg.mp3",
          "credit": "Panis Angelicus - Llanelli Male Voice Choir.ogg (cc by-sa 3.0)",
          "yt": "dkrW3nRPGo4"
        },
        {
          "t": "Ave Maria",
          "a": "Franz Schubert",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6f/Franz_Schubert_-_Ellens_dritter_Gesang.oga/Franz_Schubert_-_Ellens_dritter_Gesang.oga.mp3",
          "credit": "Franz Schubert - Ellens dritter Gesang.oga (cc by 3.0)",
          "yt": "fi3n-6TRosw"
        },
        {
          "t": "O Magnum Mysterium",
          "a": "Morten Lauridsen",
          "yt": "tZ-nuU-hda8"
        },
        {
          "t": "Holy, Holy, Holy",
          "a": "Reginald Heber",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0d/Holy%2C_Holy%2C_Holy.ogg/Holy%2C_Holy%2C_Holy.ogg.mp3",
          "credit": "Holy, Holy, Holy.ogg (cc by-sa 4.0)",
          "yt": "2qCmtUhiKcA"
        },
        {
          "t": "Here I Am to Worship",
          "a": "Tim Hughes",
          "yt": "b_KNvkk2G-Y"
        },
        {
          "t": "Lord, Prepare Me to Be a Sanctuary",
          "a": "John W. Thompson",
          "yt": "lCIwvd8cTQ0"
        },
        {
          "t": "Cantique de Jean Racine",
          "a": "Gabriel Fauré",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fe/Les_petits_chanteurs_de_Montigny_Cantique_de_Jean_Racine_%28Gabriel_Faure%29.ogg/Les_petits_chanteurs_de_Montigny_Cantique_de_Jean_Racine_%28Gabriel_Faure%29.ogg.mp3",
          "credit": "Les petits chanteurs de Montigny Cantique de Jean Racine (Gabriel Faure).ogg (cc by-sa 2.0)",
          "yt": "98Uziczd9cA"
        }
      ]
    },
    {
      "key": "family",
      "title": "Home & Family",
      "blurb": "For the kitchen, the car and bedtime.",
      "cover": "music-family",
      "tracks": [
        {
          "t": "Love at Home",
          "a": "Hymn",
          "yt": "tn5UeEFw4QQ"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn",
          "yt": "vgvY0Mo0yKA"
        },
        {
          "t": "Home Can Be a Heaven on Earth",
          "a": "Hymn",
          "yt": "Cn9kL-VR3Jw"
        },
        {
          "t": "I Am a Child of God",
          "a": "Hymn",
          "yt": "xglz6kryORQ"
        },
        {
          "t": "Each Life That Touches Ours for Good",
          "a": "Hymn",
          "yt": "t90eU0Kputg"
        },
        {
          "t": "Love One Another",
          "a": "Hymn",
          "yt": "dADRjUKnpDI"
        },
        {
          "t": "Holding Hands Around the World",
          "a": "Hymn",
          "yt": "-mgVAgW6mU4"
        },
        {
          "t": "Welcome Home",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "God Be with You Till We Meet Again",
          "a": "Hymn",
          "yt": "GZ1-tdE6kdc"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary",
          "yt": "bse5TtEuaGk"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary",
          "yt": "MAUr-clpihg"
        },
        {
          "t": "Love Is Spoken Here",
          "a": "Primary",
          "yt": "S39Z6PPC1FM"
        },
        {
          "t": "A Happy Family",
          "a": "Primary",
          "yt": "MaQYQnrPgSM"
        },
        {
          "t": "Mother, I Love You",
          "a": "Primary",
          "yt": "ffSSeXd_E6I"
        },
        {
          "t": "Daddy's Homecoming",
          "a": "Primary",
          "yt": "MZdG4G6Cqm8"
        },
        {
          "t": "Kindness Begins with Me",
          "a": "Primary",
          "yt": "PWiSXDNtikQ"
        },
        {
          "t": "I'll Walk with You",
          "a": "Primary",
          "yt": "xxJyEAa1xf8"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen",
          "yt": "YQTGIGZY7Yg"
        },
        {
          "t": "The Prayer",
          "a": "David Foster & Carole Bayer Sager",
          "yt": "BsxZHtj_tMk"
        },
        {
          "t": "Bless This House",
          "a": "May H. Brahe",
          "url": "",
          "yt": "AAqtPyw7hXM"
        },
        {
          "t": "Turn Around",
          "a": "Harry Belafonte",
          "yt": "dTL-fwRsEdc"
        },
        {
          "t": "In My Life",
          "a": "The Beatles",
          "yt": "YBcdt6DsLQA"
        }
      ]
    },
    {
      "key": "primary",
      "title": "Primary Favorites",
      "blurb": "The songs the kids already know.",
      "cover": "music-primary",
      "tracks": [
        {
          "t": "I Am a Child of God",
          "a": "Primary",
          "yt": "xglz6kryORQ"
        },
        {
          "t": "Follow the Prophet",
          "a": "Primary",
          "yt": "zoQuBqx3mck"
        },
        {
          "t": "Book of Mormon Stories",
          "a": "Primary",
          "yt": "kv7WbDcFyRE"
        },
        {
          "t": "I Love to See the Temple",
          "a": "Primary",
          "yt": "6ha9a9YF3UI"
        },
        {
          "t": "Nephi's Courage",
          "a": "Primary",
          "yt": "xGFuPbuHRBY"
        },
        {
          "t": "The Church of Jesus Christ",
          "a": "Primary",
          "yt": "XlR7oBYT32U"
        },
        {
          "t": "I Hope They Call Me on a Mission",
          "a": "Primary",
          "yt": "-VkrOLsheG4"
        },
        {
          "t": "When I Am Baptized",
          "a": "Primary",
          "yt": "PWiSXDNtikQ"
        },
        {
          "t": "I Will Follow God's Plan",
          "a": "Primary",
          "yt": "90GGIM4a6e4"
        },
        {
          "t": "Choose the Right Way",
          "a": "Primary",
          "yt": "Eg5O2y1UXw4"
        },
        {
          "t": "Jesus Wants Me for a Sunbeam",
          "a": "Primary",
          "yt": "kXtwD8qY_WA"
        },
        {
          "t": "Teach Me to Walk in the Light",
          "a": "Primary",
          "yt": "kK7XnmUzUUA"
        },
        {
          "t": "Search, Ponder, and Pray",
          "a": "Primary",
          "yt": "S2YkknoZM-o"
        },
        {
          "t": "Scripture Power",
          "a": "Clive Romney",
          "yt": "Xb_R8Za0IN8"
        },
        {
          "t": "The Family Is of God",
          "a": "Matthew Neeley",
          "yt": "H6tj7A_RXb4"
        },
        {
          "t": "Gethsemane",
          "a": "Hymn",
          "yt": "5qqxcO26MKM"
        },
        {
          "t": "I Know That My Savior Loves Me",
          "a": "Tami Jeppson Creamer",
          "yt": "ud9oAwSNZ-g"
        },
        {
          "t": "Popcorn Popping",
          "a": "Primary",
          "yt": "7mc3XoTJ_Bk"
        },
        {
          "t": "Once There Was a Snowman",
          "a": "Primary",
          "yt": "gnvuM17_JrY"
        },
        {
          "t": "Give, Said the Little Stream",
          "a": "Primary",
          "yt": "S2YkknoZM-o"
        },
        {
          "t": "Do As I'm Doing",
          "a": "Primary",
          "yt": "PWiSXDNtikQ"
        },
        {
          "t": "Hinges",
          "a": "Primary",
          "yt": "qONwvn-s7eg"
        },
        {
          "t": "Head, Shoulders, Knees, and Toes",
          "a": "Primary",
          "yt": "iF_rdlev-pw"
        },
        {
          "t": "My Heavenly Father Loves Me",
          "a": "Primary",
          "yt": "7XSE63QIc7I"
        },
        {
          "t": "The Wise Man and the Foolish Man",
          "a": "Primary",
          "yt": "6md5T6EMN3k"
        },
        {
          "t": "Samuel Tells of the Baby Jesus",
          "a": "Primary",
          "yt": "BBZ7AfZR9xs"
        }
      ]
    },
    {
      "key": "morning",
      "title": "Morning",
      "blurb": "Light, brisk, bright. Start here.",
      "cover": "music-morning",
      "tracks": [
        {
          "t": "Did You Think to Pray?",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "There Is Sunshine in My Soul Today",
          "a": "Hymn",
          "yt": "zliwkcXzVaA"
        },
        {
          "t": "The Morning Breaks",
          "a": "Hymn",
          "yt": "wLsYNUd_Zq4"
        },
        {
          "t": "Come, Ye Children of the Lord",
          "a": "Hymn",
          "yt": "GjrMfuwdh6g"
        },
        {
          "t": "Let Zion in Her Beauty Rise",
          "a": "Hymn",
          "yt": "2ECFF9hxjoI"
        },
        {
          "t": "Scatter Sunshine",
          "a": "Hymn",
          "yt": "sIfZVmFIspg"
        },
        {
          "t": "Have I Done Any Good?",
          "a": "Hymn",
          "yt": "vT-5zSlASjg"
        },
        {
          "t": "Today, While the Sun Shines",
          "a": "Hymn",
          "yt": "zliwkcXzVaA"
        },
        {
          "t": "Star Bright",
          "a": "Hymn",
          "yt": "xpJkEWuEYc0"
        },
        {
          "t": "Jesus Wants Me for a Sunbeam",
          "a": "Primary",
          "yt": "kXtwD8qY_WA"
        },
        {
          "t": "Morning Has Broken",
          "a": "Cat Stevens",
          "yt": "DmAOBosGlHY"
        },
        {
          "t": "This Is the Day",
          "a": "Les Garrett",
          "yt": "AwrDtz4HXz4"
        },
        {
          "t": "Rise and Shine",
          "a": "Spiritual",
          "url": "",
          "yt": "JKNy72zGheo"
        },
        {
          "t": "Every Morning",
          "a": "Hillsong Worship",
          "yt": "XGElZHWQEyM"
        },
        {
          "t": "New Wine",
          "a": "Hillsong Worship",
          "yt": "1ozGKlOzEVc"
        },
        {
          "t": "Hallelujah Chorus (Mount of Olives)",
          "a": "Ludwig van Beethoven",
          "url": "",
          "yt": "xK-IHpN1HBs"
        },
        {
          "t": "Morning Mood (Peer Gynt)",
          "a": "Edvard Grieg",
          "url": "",
          "yt": "PjMIVpBdR7M"
        },
        {
          "t": "Awake, My Soul",
          "a": "Mumford & Sons",
          "yt": "PjM6Jbd__Qc"
        }
      ]
    },
    {
      "key": "evening",
      "title": "Evening & Bedtime",
      "blurb": "Wind down. The words are quiet on purpose.",
      "cover": "music-evening",
      "tracks": [
        {
          "t": "Abide with Me; 'Tis Eventide",
          "a": "Hymn",
          "yt": "Q_F0mWGTN04"
        },
        {
          "t": "Softly Now the Light of Day",
          "a": "Hymn",
          "yt": "rdUV8xIcfnY"
        },
        {
          "t": "Now the Day Is Over",
          "a": "Hymn",
          "yt": "uL8BubXw7YU"
        },
        {
          "t": "Lord, We Ask Thee Ere We Part",
          "a": "Hymn",
          "yt": "Eg5O2y1UXw4"
        },
        {
          "t": "Sing We Now at Parting",
          "a": "Hymn",
          "yt": "YNTonOfMwjE"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn",
          "yt": "fCbZJwhpTmo"
        },
        {
          "t": "The Day Dawn Is Breaking",
          "a": "Hymn",
          "yt": "s32jhE341yo"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary",
          "yt": "bse5TtEuaGk"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary",
          "yt": "MAUr-clpihg"
        },
        {
          "t": "Heavenly Father, Now I Pray",
          "a": "Primary",
          "yt": "bse5TtEuaGk"
        },
        {
          "t": "Nocturne (Chopin, Op. 9 No. 2)",
          "a": "Frédéric Chopin",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/89/Chopin_-_Nocturne_No._2_in_E-flat_major%2C_Op._9_No._2_%28Frank_Levy%29.flac/Chopin_-_Nocturne_No._2_in_E-flat_major%2C_Op._9_No._2_%28Frank_Levy%29.flac.mp3",
          "credit": "Chopin - Nocturne No. 2 in E-flat major, Op. 9 No. 2 (Frank Levy).flac (public domain)",
          "yt": "mvc94N0TTl0"
        },
        {
          "t": "Clair de lune",
          "a": "Claude Debussy",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5b/Clair_de_Lune_WikiOrchestra_backing_track_basses.ogg/Clair_de_Lune_WikiOrchestra_backing_track_basses.ogg.mp3",
          "credit": "Clair de Lune WikiOrchestra backing track basses.ogg (public domain)",
          "yt": "adD_xwxHBHw"
        },
        {
          "t": "Gymnopédie No. 1",
          "a": "Erik Satie",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/90/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg.mp3",
          "credit": "Erik Satie - gymnopedies - la 1 ere. lent et douloureux.ogg (public domain)",
          "yt": "m4oZZhpMXP4"
        },
        {
          "t": "Sleep",
          "a": "Eric Whitacre",
          "yt": "Yw5gupbe9E0"
        },
        {
          "t": "The Seal Lullaby",
          "a": "Eric Whitacre",
          "yt": "TL7HkwnzENo"
        },
        {
          "t": "Evening Prayer (Hansel and Gretel)",
          "a": "Engelbert Humperdinck",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/44/Evening_prayer.ogg/Evening_prayer.ogg.mp3",
          "credit": "Evening prayer.ogg (public domain)",
          "yt": "N2sUPWWf00s"
        },
        {
          "t": "All Through the Night",
          "a": "Welsh lullaby",
          "url": "",
          "yt": "LK7PIS2RtgA"
        },
        {
          "t": "Goodnight My Angel",
          "a": "Billy Joel",
          "yt": "dcnd55tLCv8"
        }
      ]
    },
    {
      "key": "temple",
      "title": "Temple",
      "blurb": "Covenant, holiness, the house of the Lord.",
      "cover": "saints-volume-2",
      "tracks": [
        {
          "t": "I Love to See the Temple",
          "a": "Primary",
          "yt": "6ha9a9YF3UI"
        },
        {
          "t": "Holy Places",
          "a": "Hymn",
          "yt": "5PAc3krFyQA"
        },
        {
          "t": "The Spirit of God",
          "a": "Hymn",
          "yt": "608cbv7Qe_A"
        },
        {
          "t": "Turn Your Hearts",
          "a": "Hymn",
          "yt": "bcTkAY4_XUI"
        },
        {
          "t": "How Beautiful Thy Temples, Lord",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Rise, Ye Saints, and Temples Enter",
          "a": "Hymn",
          "yt": "ZEMBPWmAb9w"
        },
        {
          "t": "High on the Mountain Top",
          "a": "Hymn",
          "yt": "ee9u577klxY"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn",
          "yt": "vgvY0Mo0yKA"
        },
        {
          "t": "O My Father",
          "a": "Hymn",
          "yt": "b6rO0u65R5Q"
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn",
          "yt": "xaxrY1rxZKE"
        },
        {
          "t": "More Holiness Give Me",
          "a": "Hymn",
          "yt": "n51QQTvKzKc"
        },
        {
          "t": "Come, Lord Jesus",
          "a": "Hymn",
          "yt": "GjrMfuwdh6g"
        },
        {
          "t": "Holy Ground",
          "a": "Geron Davis",
          "url": "",
          "yt": "l-pGA91NrbM"
        },
        {
          "t": "Sanctus (Requiem)",
          "a": "Gabriel Fauré",
          "url": "",
          "yt": "NewQ-3dxu2o"
        },
        {
          "t": "How Lovely Is Thy Dwelling Place",
          "a": "Johannes Brahms",
          "url": "",
          "yt": "XwnZ748e3CA"
        },
        {
          "t": "I Was Glad",
          "a": "C. Hubert H. Parry",
          "url": "",
          "yt": "Q_OHXYz_qxs"
        },
        {
          "t": "Holy Is the Lord",
          "a": "Chris Tomlin",
          "yt": "hVWBt8bfmCs"
        },
        {
          "t": "Take Me Into the Holy of Holies",
          "a": "Dave Browning",
          "yt": "Skbxfv1mWKM"
        }
      ]
    },
    {
      "key": "missionary",
      "title": "Missionary",
      "blurb": "For the call, the field and the ones waiting at home.",
      "cover": "music-missionary",
      "tracks": [
        {
          "t": "Called to Serve",
          "a": "Hymn",
          "yt": "H9OqRPEWdcA"
        },
        {
          "t": "I'll Go Where You Want Me to Go",
          "a": "Hymn",
          "yt": "JvMso9bFm0k"
        },
        {
          "t": "Go, Ye Messengers of Glory",
          "a": "Hymn",
          "yt": "_adBCHQhBo8"
        },
        {
          "t": "Hark, All Ye Nations!",
          "a": "Hymn",
          "yt": "Omb79iRQNz4"
        },
        {
          "t": "Israel, Israel, God Is Calling",
          "a": "Hymn",
          "yt": "fyju2aFehFI"
        },
        {
          "t": "Ye Elders of Israel (Men)",
          "a": "Hymn",
          "yt": "BMx57Juey8g"
        },
        {
          "t": "The Iron Rod",
          "a": "Hymn",
          "yt": "bVWPSjlwhZg"
        },
        {
          "t": "Because I Have Been Given Much",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Have I Done Any Good?",
          "a": "Hymn",
          "yt": "vT-5zSlASjg"
        },
        {
          "t": "Let Us All Press On",
          "a": "Hymn",
          "yt": "a2qPlvxuCLg"
        },
        {
          "t": "Go Forth with Faith",
          "a": "Hymn",
          "yt": "bRdJO4EHCMI"
        },
        {
          "t": "I Hope They Call Me on a Mission",
          "a": "Primary",
          "yt": "-4Ike3DR7e4"
        },
        {
          "t": "We'll Bring the World His Truth (Army of Helaman)",
          "a": "Primary",
          "yt": "PUjScQJnEKA"
        },
        {
          "t": "Called to Serve (Rob Gardner)",
          "a": "Rob Gardner",
          "yt": "jQTWl7O1cdo"
        },
        {
          "t": "Go Light Your World",
          "a": "Chris Rice",
          "yt": "Frobrm1t61A"
        },
        {
          "t": "Here I Am, Lord",
          "a": "Dan Schutte",
          "yt": "Z4ATBaI7ycY"
        },
        {
          "t": "The Summons (Will You Come and Follow Me)",
          "a": "John L. Bell",
          "yt": "6FasN8fukrs"
        },
        {
          "t": "Send Me",
          "a": "Lecrae",
          "yt": "N5F_NpYutiI"
        }
      ]
    },
    {
      "key": "prayer",
      "title": "Prayer",
      "blurb": "Music to pray to, and about praying.",
      "cover": "music-prayer",
      "tracks": [
        {
          "t": "Did You Think to Pray?",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Secret Prayer",
          "a": "Hymn",
          "yt": "gznfnzz4Eho"
        },
        {
          "t": "Sweet Hour of Prayer",
          "a": "Hymn",
          "yt": "CdxQbxpRl9Y"
        },
        {
          "t": "Prayer Is the Soul's Sincere Desire",
          "a": "Hymn",
          "yt": "xue8HBHFFZA"
        },
        {
          "t": "I Need Thee Every Hour",
          "a": "Hymn",
          "yt": "PPEdmbgga_o"
        },
        {
          "t": "Father in Heaven",
          "a": "Hymn",
          "yt": "fi3n-6TRosw"
        },
        {
          "t": "Guide Us, O Thou Great Jehovah",
          "a": "Hymn",
          "yt": "seEIAH9g-QA"
        },
        {
          "t": "Be Thou Humble",
          "a": "Hymn",
          "yt": "hVODvZyvfjo"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary",
          "yt": "bse5TtEuaGk"
        },
        {
          "t": "I Pray in Faith",
          "a": "Primary",
          "yt": "AN1L2ZABMuQ"
        },
        {
          "t": "The Lord's Prayer",
          "a": "Albert Hay Malotte",
          "url": "",
          "yt": "1_TMhZifjAA"
        },
        {
          "t": "Pater noster",
          "a": "Igor Stravinsky",
          "url": "",
          "yt": "_G3MgSIzSt8"
        },
        {
          "t": "Ubi caritas",
          "a": "Maurice Duruflé",
          "url": "",
          "yt": "PPs9H-txDPk"
        },
        {
          "t": "Prayer of Saint Francis",
          "a": "Sebastian Temple",
          "yt": "vs644Vp_mLM"
        },
        {
          "t": "Hear My Prayer, O Lord",
          "a": "Henry Purcell",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ee/Purcell_hear_my_prayer%2C_o_lord.ogg/Purcell_hear_my_prayer%2C_o_lord.ogg.mp3",
          "credit": "Purcell hear my prayer, o lord.ogg (cc by-sa 1.0)",
          "yt": "CdxQbxpRl9Y"
        },
        {
          "t": "What a Friend We Have in Jesus",
          "a": "Joseph M. Scriven",
          "url": "",
          "yt": "6ha9a9YF3UI"
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn",
          "yt": "xaxrY1rxZKE"
        },
        {
          "t": "Lord, Listen to Your Children Praying",
          "a": "Ken Medema",
          "yt": "whkw9lV9O0E"
        }
      ]
    },
    {
      "key": "grief",
      "title": "Grief & Loss",
      "blurb": "For funerals, anniversaries and the quiet after.",
      "cover": "music-grief",
      "tracks": [
        {
          "t": "Each Life That Touches Ours for Good",
          "a": "Hymn",
          "yt": "t90eU0Kputg"
        },
        {
          "t": "God Be with You Till We Meet Again",
          "a": "Hymn",
          "yt": "GZ1-tdE6kdc"
        },
        {
          "t": "O My Father",
          "a": "Hymn",
          "yt": "b6rO0u65R5Q"
        },
        {
          "t": "Abide with Me!",
          "a": "Hymn",
          "yt": "YvZsOTJEUUc"
        },
        {
          "t": "Where Can I Turn for Peace?",
          "a": "Hymn",
          "yt": "XJvZFUZ-c0I"
        },
        {
          "t": "Be Still, My Soul",
          "a": "Hymn",
          "yt": "cHNT6G9ZKik"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn",
          "yt": "vgvY0Mo0yKA"
        },
        {
          "t": "Come, Come, Ye Saints",
          "a": "Hymn",
          "yt": "4ia3gYSvG8M"
        },
        {
          "t": "My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Behold the Wounds in Jesus' Hands",
          "a": "Hymn",
          "yt": "b9SSGNpQ_IQ"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman",
          "yt": "ilEed_1B0dk"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen",
          "yt": "YQTGIGZY7Yg"
        },
        {
          "t": "Going Home",
          "a": "Antonín Dvořák",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/74/%22Goin%27_Home%22%2C_performed_by_the_United_States_Air_Force_Band.oga/%22Goin%27_Home%22%2C_performed_by_the_United_States_Air_Force_Band.oga.mp3",
          "credit": "\"Goin' Home\", performed by the United States Air Force Band.oga (public domain)",
          "yt": "AAw78FOkhZs"
        },
        {
          "t": "Pie Jesu",
          "a": "Gabriel Fauré",
          "url": "",
          "yt": "oduhc96kTlw"
        },
        {
          "t": "In paradisum (Requiem)",
          "a": "Gabriel Fauré",
          "url": "",
          "yt": "JW7aDiV-i-k"
        },
        {
          "t": "Lacrimosa (Requiem)",
          "a": "W. A. Mozart",
          "url": "",
          "yt": "JW7aDiV-i-k"
        },
        {
          "t": "It Is Well with My Soul",
          "a": "Horatio Spafford",
          "yt": "8tdoWK34lpc"
        },
        {
          "t": "I Will Rise",
          "a": "Chris Tomlin",
          "yt": "l6paJbntGpU"
        },
        {
          "t": "Homesick",
          "a": "MercyMe",
          "yt": "PSTCG9qHFy0"
        },
        {
          "t": "See You Again",
          "a": "Carrie Underwood",
          "yt": "vTnWFT3DvVA"
        }
      ]
    },
    {
      "key": "pioneer",
      "title": "Pioneer Heritage",
      "blurb": "Handcarts, the trail, the valley.",
      "cover": "music-pioneer",
      "tracks": [
        {
          "t": "Come, Come, Ye Saints",
          "a": "Hymn",
          "yt": "4ia3gYSvG8M"
        },
        {
          "t": "They, the Builders of the Nation",
          "a": "Hymn",
          "yt": "rCBdjHzSvN0"
        },
        {
          "t": "Carry On",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "Zion Stands with Hills Surrounded",
          "a": "Hymn",
          "yt": "GY_8krGj-lw"
        },
        {
          "t": "For the Strength of the Hills",
          "a": "Hymn",
          "yt": "WmoG5b3f39k"
        },
        {
          "t": "Our Mountain Home So Dear",
          "a": "Hymn",
          "yt": "8mmvPtup50I"
        },
        {
          "t": "Faith in Every Footstep",
          "a": "Hymn",
          "yt": "6jH4mOEDu5w"
        },
        {
          "t": "Pioneer Children Sang As They Walked",
          "a": "Primary",
          "yt": "H8qb2OgObh8"
        },
        {
          "t": "To Be a Pioneer",
          "a": "Primary",
          "yt": "OdhiYv-rjy0"
        },
        {
          "t": "Whenever I Think about Pioneers",
          "a": "Primary",
          "yt": "4ia3gYSvG8M"
        },
        {
          "t": "Little Pioneer Children (Round)",
          "a": "Primary",
          "yt": "EFe84U__kt8"
        },
        {
          "t": "The Handcart Song",
          "a": "Pioneer song",
          "yt": "g0wNthc5Uh8"
        },
        {
          "t": "Faith in Every Footstep (Choir)",
          "a": "K. Newell Dayley",
          "yt": "LfYPKIuC4_g"
        },
        {
          "t": "All Is Well (Come, Come, Ye Saints)",
          "a": "Tabernacle Choir at Temple Square",
          "yt": "4ia3gYSvG8M"
        },
        {
          "t": "Shenandoah",
          "a": "American folk song",
          "url": "https://upload.wikimedia.org/wikipedia/commons/4/47/Shenandoah_-_Singing_Sergeants_-_United_States_Air_Force_Band.mp3?utm_source=commons.wikimedia.org&utm_campaign=api&utm_content=original",
          "credit": "Shenandoah - Singing Sergeants - United States Air Force Band.mp3 (public domain)",
          "yt": "-GtwNJf3EK4"
        },
        {
          "t": "Simple Gifts",
          "a": "Shaker song",
          "yt": "baNueuDCue0"
        },
        {
          "t": "Wayfaring Stranger",
          "a": "American folk song",
          "url": "",
          "yt": "LtgKoJ5hoZw"
        }
      ]
    },
    {
      "key": "choir",
      "title": "Choir Classics",
      "blurb": "The big, beautiful ones.",
      "cover": "music-choir",
      "tracks": [
        {
          "t": "Hallelujah (Messiah)",
          "a": "G. F. Handel",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3f/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg.mp3",
          "credit": "Handel Messiah Hallelujah by Oratorio Chorus.ogg (public domain)",
          "yt": "BBZ7AfZR9xs"
        },
        {
          "t": "The Spirit of God",
          "a": "Hymn",
          "yt": "608cbv7Qe_A"
        },
        {
          "t": "Come, Thou Fount of Every Blessing",
          "a": "Hymn",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Battle Hymn of the Republic",
          "a": "Tabernacle Choir at Temple Square",
          "yt": "G9anfFdAr3E"
        },
        {
          "t": "O Divine Redeemer",
          "a": "Charles Gounod",
          "url": "",
          "yt": "tQPC-SX-Rvw"
        },
        {
          "t": "Betelehemu",
          "a": "Nigerian carol",
          "yt": "9-j6U309hT0"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman",
          "yt": "ilEed_1B0dk"
        },
        {
          "t": "The Lord Bless You and Keep You",
          "a": "John Rutter",
          "yt": "QcYzO8Y4PH0"
        },
        {
          "t": "For the Beauty of the Earth",
          "a": "John Rutter",
          "yt": "1bDoMflYErE"
        },
        {
          "t": "O Magnum Mysterium",
          "a": "Morten Lauridsen",
          "yt": "tZ-nuU-hda8"
        },
        {
          "t": "Ave Maria",
          "a": "Franz Biebl",
          "yt": "41KBZsdC2dw"
        },
        {
          "t": "Sicut cervus",
          "a": "G. P. da Palestrina",
          "url": "",
          "yt": "xK-IHpN1HBs"
        },
        {
          "t": "Miserere mei, Deus",
          "a": "Gregorio Allegri",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d7/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg.mp3",
          "credit": "Allegri - Miserere Mei, Deus - Ensamble Escénico Vocal (audio).ogg (cc by 3.0)",
          "yt": "aQ78UKW63Sw"
        },
        {
          "t": "Spem in alium",
          "a": "Thomas Tallis",
          "url": "",
          "yt": "tTeDpI8SYOs"
        },
        {
          "t": "Nearer, My God, to Thee (BYU Vocal Point)",
          "a": "BYU Vocal Point",
          "yt": "o1trWhBvZTs"
        },
        {
          "t": "Requiem: Pie Jesu",
          "a": "Andrew Lloyd Webber",
          "yt": "31oAcmBz044"
        },
        {
          "t": "The Ground (Sunrise Mass)",
          "a": "Ola Gjeilo",
          "yt": "NorBm-T0MKA"
        },
        {
          "t": "Northern Lights",
          "a": "Ola Gjeilo",
          "yt": "NspOpsKs8vc"
        }
      ]
    },
    {
      "key": "faith",
      "title": "Faith",
      "blurb": "Believing, and choosing to keep believing.",
      "cover": "music-faith",
      "tracks": [
        {
          "t": "I Believe in Christ",
          "a": "Hymn",
          "yt": "RcGFkzBJ_1o"
        },
        {
          "t": "How Firm a Foundation",
          "a": "Hymn",
          "yt": "r0Xvr8maR34"
        },
        {
          "t": "Testimony",
          "a": "Hymn",
          "yt": "hgkYuAsrx2I"
        },
        {
          "t": "The Iron Rod",
          "a": "Hymn",
          "yt": "RbCbCf0b0h8"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn",
          "yt": "fCbZJwhpTmo"
        },
        {
          "t": "Guide Us, O Thou Great Jehovah",
          "a": "Hymn",
          "yt": "seEIAH9g-QA"
        },
        {
          "t": "A Mighty Fortress Is Our God",
          "a": "Hymn",
          "yt": "R5vR6Fo6YOE"
        },
        {
          "t": "I Will Walk with Jesus",
          "a": "Hymn",
          "yt": "xxJyEAa1xf8"
        },
        {
          "t": "Faith",
          "a": "Primary",
          "yt": "AN1L2ZABMuQ"
        },
        {
          "t": "I Know My Father Lives",
          "a": "Primary",
          "yt": "h_k9FNS-Vdc"
        },
        {
          "t": "Search, Ponder, and Pray",
          "a": "Primary",
          "yt": "S2YkknoZM-o"
        },
        {
          "t": "Oceans (Where Feet May Fail)",
          "a": "Hillsong United",
          "yt": "OP-00EwLdiU"
        },
        {
          "t": "Build My Life",
          "a": "Housefires",
          "yt": "FYMjO9mL0Tw"
        },
        {
          "t": "Trust in You",
          "a": "Lauren Daigle",
          "yt": "qv-SXz_exKE"
        },
        {
          "t": "Blessed Assurance",
          "a": "Fanny Crosby",
          "url": "",
          "yt": "gPKpkrqBwNs"
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan",
          "yt": "mMEgkCbCTGo"
        },
        {
          "t": "Waymaker",
          "a": "Leeland",
          "yt": "iJCV_2H9xD0"
        },
        {
          "t": "Even If",
          "a": "MercyMe",
          "yt": "B6fA35Ved-Y"
        },
        {
          "t": "Believe for It",
          "a": "CeCe Winans",
          "yt": "fd24fpsF1Qw"
        }
      ]
    },
    {
      "key": "christmas",
      "title": "Christmas",
      "blurb": "The nativity, sung.",
      "cover": "music-christmas",
      "tracks": [
        {
          "t": "Silent Night",
          "a": "Hymn",
          "yt": "lmFh6QW7Q-8"
        },
        {
          "t": "Joy to the World",
          "a": "Hymn",
          "yt": "7r3VVMUhAxU"
        },
        {
          "t": "O Little Town of Bethlehem",
          "a": "Hymn",
          "yt": "4EoLzTQXRHU"
        },
        {
          "t": "Far, Far Away on Judea's Plains",
          "a": "Hymn",
          "yt": "5JAFvF_kzuY"
        },
        {
          "t": "Away in a Manger",
          "a": "Hymn",
          "yt": "PLWnarUwamU"
        },
        {
          "t": "Hark! The Herald Angels Sing",
          "a": "Hymn",
          "yt": "SFjMPaOBzXc"
        },
        {
          "t": "Oh, Come, All Ye Faithful",
          "a": "Hymn",
          "yt": "EE8HZHNXgHs"
        },
        {
          "t": "With Wondering Awe",
          "a": "Hymn",
          "yt": "NOpgkAKB3Tk"
        },
        {
          "t": "He Is Born, the Divine Christ Child",
          "a": "Hymn",
          "yt": "eQN9oCTHtSc"
        },
        {
          "t": "Still, Still, Still",
          "a": "Hymn",
          "yt": "5rflf6NEQ6I"
        },
        {
          "t": "What Child Is This?",
          "a": "Hymn",
          "yt": "OdbKpxwKqco"
        },
        {
          "t": "Once in Royal David's City",
          "a": "Hymn",
          "yt": "dpdbOWhe_is"
        },
        {
          "t": "It Came upon the Midnight Clear",
          "a": "Hymn",
          "yt": "8I3w4myHnsY"
        },
        {
          "t": "The First Noel",
          "a": "Hymn",
          "yt": "GW5_jqtITZg"
        },
        {
          "t": "Angels We Have Heard on High",
          "a": "Hymn",
          "yt": "JN3eWe44VTg"
        },
        {
          "t": "Samuel Tells of the Baby Jesus",
          "a": "Primary",
          "yt": "BBZ7AfZR9xs"
        },
        {
          "t": "Stars Were Gleaming",
          "a": "Primary",
          "yt": "V2sLwhXwC4A"
        },
        {
          "t": "The Nativity Song",
          "a": "Primary",
          "yt": "k-W2Bkz_Rno"
        },
        {
          "t": "O Holy Night",
          "a": "Adolphe Adam",
          "yt": "TiBboiXW6b0"
        },
        {
          "t": "O Come, O Come, Emmanuel",
          "a": "Plainsong",
          "url": "",
          "yt": "FqkUPUSY8ds"
        },
        {
          "t": "In the Bleak Midwinter",
          "a": "Gustav Holst",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8a/Gustav_Theodore_Holst_-_In_the_Bleak_Midwinter_-_%28A_Christmas_Carol%29.ogg/Gustav_Theodore_Holst_-_In_the_Bleak_Midwinter_-_%28A_Christmas_Carol%29.ogg.mp3",
          "credit": "Gustav Theodore Holst - In the Bleak Midwinter - (A Christmas Carol).ogg (public domain)",
          "yt": "OB2bCpROFv8"
        },
        {
          "t": "Mary, Did You Know?",
          "a": "Mark Lowry & Buddy Greene",
          "url": "",
          "yt": "4wQEbiDPpPw"
        },
        {
          "t": "Breath of Heaven (Mary's Song)",
          "a": "Amy Grant",
          "yt": "FWo3qlqyW1c"
        },
        {
          "t": "Carol of the Bells",
          "a": "Mykola Leontovych",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6b/Shchedryk%27s_%22Carol_of_the_Bells%22_%281922%29.oga/Shchedryk%27s_%22Carol_of_the_Bells%22_%281922%29.oga.mp3",
          "credit": "Shchedryk's \"Carol of the Bells\" (1922).oga (public domain)",
          "yt": "k-W2Bkz_Rno"
        },
        {
          "t": "Gesù bambino",
          "a": "Pietro Yon",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7c/U.S._Army_Band_-_Ges%C3%B9_Bambino.ogg/U.S._Army_Band_-_Ges%C3%B9_Bambino.ogg.mp3",
          "credit": "U.S. Army Band - Gesù Bambino.ogg (public domain)",
          "yt": "yCvJWyBPDQM"
        },
        {
          "t": "Betelehemu",
          "a": "Nigerian carol",
          "yt": "9-j6U309hT0"
        },
        {
          "t": "Candlelight Carol",
          "a": "John Rutter",
          "yt": "MbudPRPrFWI"
        },
        {
          "t": "Little Drummer Boy",
          "a": "Katherine K. Davis",
          "url": "",
          "yt": "Tj9VTiqy76Y"
        }
      ]
    },
    {
      "key": "easter",
      "title": "Easter",
      "blurb": "Gethsemane, the cross, the empty tomb.",
      "cover": "music-easter",
      "tracks": [
        {
          "t": "Gethsemane",
          "a": "Hymn",
          "yt": "5qqxcO26MKM"
        },
        {
          "t": "There Is a Green Hill Far Away",
          "a": "Hymn",
          "yt": "LtgKoJ5hoZw"
        },
        {
          "t": "Behold the Great Redeemer Die",
          "a": "Hymn",
          "yt": "tQPC-SX-Rvw"
        },
        {
          "t": "Upon the Cross of Calvary",
          "a": "Hymn",
          "yt": "NOpgkAKB3Tk"
        },
        {
          "t": "He Is Risen!",
          "a": "Hymn",
          "yt": "jVD7LCiBNAA"
        },
        {
          "t": "Christ the Lord Is Risen Today",
          "a": "Hymn",
          "yt": "cErtpg5hBSw"
        },
        {
          "t": "That Easter Morn",
          "a": "Hymn",
          "yt": "ksicI-P75YA"
        },
        {
          "t": "My Redeemer Lives",
          "a": "Hymn",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Hail the Day That Sees Him Rise",
          "a": "Hymn",
          "yt": "jAAbsKihzuI"
        },
        {
          "t": "Jesus Has Risen",
          "a": "Primary",
          "yt": "jVD7LCiBNAA"
        },
        {
          "t": "Did Jesus Really Live Again?",
          "a": "Primary",
          "yt": "cErtpg5hBSw"
        },
        {
          "t": "Easter Hosanna",
          "a": "Primary",
          "yt": "cErtpg5hBSw"
        },
        {
          "t": "Were You There?",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d6/01._Patrick_Kilpatrick_-_Did_you_jump_or_were_you_dropped.ogg/01._Patrick_Kilpatrick_-_Did_you_jump_or_were_you_dropped.ogg.mp3",
          "credit": "01. Patrick Kilpatrick - Did you jump or were you dropped.ogg (cc0)",
          "yt": "kN3tYsZb-t0"
        },
        {
          "t": "I Know That My Redeemer Liveth",
          "a": "G. F. Handel",
          "url": "",
          "yt": "_1Uw-4Q4UfI"
        },
        {
          "t": "Because He Lives",
          "a": "Bill & Gloria Gaither",
          "yt": "spa7WkwjwGw"
        },
        {
          "t": "Easter Hymn (Cavalleria rusticana)",
          "a": "Pietro Mascagni",
          "url": "",
          "yt": "5e36mTXL-CE"
        },
        {
          "t": "Living Hope",
          "a": "Phil Wickham",
          "yt": "u-1fwZtKJSM"
        },
        {
          "t": "Glorious Day",
          "a": "Passion",
          "yt": "LfzpfqrPUDo"
        },
        {
          "t": "Resurrection Power",
          "a": "Chris Tomlin",
          "yt": "AxH8Q8ue65o"
        },
        {
          "t": "Lamb of God: Gloria",
          "a": "Rob Gardner",
          "yt": "DbGL4mvqFDY"
        },
        {
          "t": "Christ Is Risen",
          "a": "Matt Maher",
          "yt": "IExdrZGQVeI"
        }
      ]
    }
  ]
}
```
