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
          "a": "Hymn"
        },
        {
          "t": "Come, Thou Fount of Every Blessing",
          "a": "Hymn"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn"
        },
        {
          "t": "How Firm a Foundation",
          "a": "Hymn"
        },
        {
          "t": "The Lord Is My Light",
          "a": "Hymn"
        },
        {
          "t": "Standing on the Promises",
          "a": "Hymn"
        },
        {
          "t": "Come unto Him",
          "a": "Hymn"
        },
        {
          "t": "Where Can I Turn for Peace?",
          "a": "Hymn"
        },
        {
          "t": "God Is Love",
          "a": "Hymn"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn"
        },
        {
          "t": "Redeemer of Israel",
          "a": "Hymn"
        },
        {
          "t": "Anytime, Anywhere",
          "a": "Hymn"
        },
        {
          "t": "I Know My Father Lives",
          "a": "Primary"
        },
        {
          "t": "Here Is Hope",
          "a": "Rob Gardner"
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan"
        },
        {
          "t": "Be Thou My Vision",
          "a": "Irish hymn"
        },
        {
          "t": "Living Hope",
          "a": "Phil Wickham"
        },
        {
          "t": "There Is a Balm in Gilead",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3b/A_balm_in_Gilead_-_Vale_Of_Towey_Male_Voice_Choir.ogg/A_balm_in_Gilead_-_Vale_Of_Towey_Male_Voice_Choir.ogg.mp3",
          "credit": "A balm in Gilead - Vale Of Towey Male Voice Choir.ogg (cc by-sa 3.0)"
        },
        {
          "t": "The Lord Bless You and Keep You",
          "a": "John Rutter"
        },
        {
          "t": "You Say",
          "a": "Lauren Daigle"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen"
        },
        {
          "t": "It Is Well",
          "a": "Bethel Music"
        },
        {
          "t": "Cornerstone",
          "a": "Hillsong Worship"
        },
        {
          "t": "Hope Has a Name",
          "a": "River Valley Worship"
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
          "a": "Hymn"
        },
        {
          "t": "Abide with Me; 'Tis Eventide",
          "a": "Hymn"
        },
        {
          "t": "Abide with Me!",
          "a": "Hymn"
        },
        {
          "t": "I Need Thee Every Hour",
          "a": "Hymn"
        },
        {
          "t": "It Is Well with My Soul",
          "a": "Hymn"
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn"
        },
        {
          "t": "His Eye Is on the Sparrow",
          "a": "Hymn"
        },
        {
          "t": "Be Still, My Soul",
          "a": "Hymn"
        },
        {
          "t": "Master, the Tempest Is Raging",
          "a": "Hymn"
        },
        {
          "t": "Jesus, Lover of My Soul",
          "a": "Hymn"
        },
        {
          "t": "Rock of Ages",
          "a": "Hymn"
        },
        {
          "t": "Softly Now the Light of Day",
          "a": "Hymn"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman"
        },
        {
          "t": "Precious Lord, Take My Hand",
          "a": "Thomas A. Dorsey"
        },
        {
          "t": "Jesu, Joy of Man's Desiring",
          "a": "J. S. Bach",
          "url": "https://upload.wikimedia.org/wikipedia/commons/5/51/Jesu%2C_Joy_of_Man%27s_Desiring_%28ISRC_USUAN1100189%29.mp3?utm_source=commons.wikimedia.org&utm_campaign=api&utm_content=original",
          "credit": "Jesu, Joy of Man's Desiring (ISRC USUAN1100189).mp3 (cc by 3.0)"
        },
        {
          "t": "Ave verum corpus",
          "a": "W. A. Mozart",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/Ave_Verum_Corpus_-_Rhymney_Millennium_Chorale.ogg/Ave_Verum_Corpus_-_Rhymney_Millennium_Chorale.ogg.mp3",
          "credit": "Ave Verum Corpus - Rhymney Millennium Chorale.ogg (cc by-sa 3.0)"
        },
        {
          "t": "Pie Jesu",
          "a": "Gabriel Fauré",
          "url": ""
        },
        {
          "t": "Deep River",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/Deep_River_-_Alun_Jones.ogg/Deep_River_-_Alun_Jones.ogg.mp3",
          "credit": "Deep River - Alun Jones.ogg (cc by-sa 3.0)"
        },
        {
          "t": "Peace Like a River",
          "a": "Spiritual",
          "url": ""
        },
        {
          "t": "Still",
          "a": "Hillsong Worship"
        },
        {
          "t": "The Lord Is My Shepherd",
          "a": "Howard Goodall"
        },
        {
          "t": "Sleep",
          "a": "Eric Whitacre"
        },
        {
          "t": "Lux aurumque",
          "a": "Eric Whitacre"
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
          "a": "Hymn"
        },
        {
          "t": "Press Forward, Saints",
          "a": "Hymn"
        },
        {
          "t": "Let Us All Press On",
          "a": "Hymn"
        },
        {
          "t": "Put Your Shoulder to the Wheel",
          "a": "Hymn"
        },
        {
          "t": "Called to Serve",
          "a": "Hymn"
        },
        {
          "t": "Go Forth with Faith",
          "a": "Hymn"
        },
        {
          "t": "Hope of Israel",
          "a": "Hymn"
        },
        {
          "t": "Carry On",
          "a": "Hymn"
        },
        {
          "t": "Faith in Every Footstep",
          "a": "Hymn"
        },
        {
          "t": "Onward, Christian Soldiers",
          "a": "Hymn"
        },
        {
          "t": "Do What Is Right",
          "a": "Hymn"
        },
        {
          "t": "Choose the Right",
          "a": "Hymn"
        },
        {
          "t": "True to the Faith",
          "a": "Hymn"
        },
        {
          "t": "Ye Elders of Israel (Men)",
          "a": "Hymn"
        },
        {
          "t": "Nephi's Courage",
          "a": "Primary"
        },
        {
          "t": "I Will Be Valiant",
          "a": "Primary"
        },
        {
          "t": "In Christ Alone",
          "a": "Keith Getty & Stuart Townend"
        },
        {
          "t": "Way Maker",
          "a": "Sinach"
        },
        {
          "t": "Total Praise",
          "a": "Richard Smallwood"
        },
        {
          "t": "Rise Up (Lazarus)",
          "a": "CAIN"
        },
        {
          "t": "Battle Belongs",
          "a": "Phil Wickham"
        },
        {
          "t": "Raise a Hallelujah",
          "a": "Bethel Music"
        },
        {
          "t": "Soldiers of Christ, Arise",
          "a": "Charles Wesley",
          "url": ""
        },
        {
          "t": "Zadok the Priest",
          "a": "G. F. Handel",
          "url": ""
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
          "a": "Hymn"
        },
        {
          "t": "Come unto Jesus",
          "a": "Hymn"
        },
        {
          "t": "Savior, Redeemer of My Soul",
          "a": "Hymn"
        },
        {
          "t": "Softly and Tenderly Jesus Is Calling",
          "a": "Hymn"
        },
        {
          "t": "Amazing Grace",
          "a": "Hymn"
        },
        {
          "t": "More Holiness Give Me",
          "a": "Hymn"
        },
        {
          "t": "Be Thou Humble",
          "a": "Hymn"
        },
        {
          "t": "Reverently and Meekly Now",
          "a": "Hymn"
        },
        {
          "t": "Jesus, Savior, Pilot Me",
          "a": "Hymn"
        },
        {
          "t": "Lord, I Would Follow Thee",
          "a": "Hymn"
        },
        {
          "t": "O Savior, Thou Who Wearest a Crown",
          "a": "Hymn"
        },
        {
          "t": "Help Me, Dear Father",
          "a": "Primary"
        },
        {
          "t": "Miserere mei, Deus",
          "a": "Gregorio Allegri",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d7/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg.mp3",
          "credit": "Allegri - Miserere Mei, Deus - Ensamble Escénico Vocal (audio).ogg (cc by 3.0)"
        },
        {
          "t": "Amazing Grace (My Chains Are Gone)",
          "a": "Chris Tomlin"
        },
        {
          "t": "Lord, I Need You",
          "a": "Matt Maher"
        },
        {
          "t": "Agnus Dei",
          "a": "Samuel Barber"
        },
        {
          "t": "Come Home",
          "a": "Tyler Castleton"
        },
        {
          "t": "O Come to the Altar",
          "a": "Elevation Worship"
        },
        {
          "t": "Nothing but the Blood",
          "a": "Robert Lowry",
          "url": ""
        },
        {
          "t": "Just As I Am",
          "a": "Charlotte Elliott",
          "url": ""
        },
        {
          "t": "Kyrie (Mass in B minor)",
          "a": "J. S. Bach",
          "url": ""
        },
        {
          "t": "The Prodigal",
          "a": "Sovereign Grace Music"
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
          "a": "Hymn"
        },
        {
          "t": "Because I Have Been Given Much",
          "a": "Hymn"
        },
        {
          "t": "For the Beauty of the Earth",
          "a": "Hymn"
        },
        {
          "t": "Now Thank We All Our God",
          "a": "Hymn"
        },
        {
          "t": "Praise to the Lord, the Almighty",
          "a": "Hymn"
        },
        {
          "t": "How Great Thou Art",
          "a": "Hymn"
        },
        {
          "t": "Prayer of Thanksgiving",
          "a": "Hymn"
        },
        {
          "t": "All Creatures of Our God and King",
          "a": "Hymn"
        },
        {
          "t": "Praise God, from Whom All Blessings Flow",
          "a": "Hymn"
        },
        {
          "t": "Come, Ye Thankful People",
          "a": "Hymn"
        },
        {
          "t": "Glory to God on High",
          "a": "Hymn"
        },
        {
          "t": "My Heavenly Father Loves Me",
          "a": "Primary"
        },
        {
          "t": "Thanks to Our Father",
          "a": "Primary"
        },
        {
          "t": "10,000 Reasons (Bless the Lord)",
          "a": "Matt Redman"
        },
        {
          "t": "Goodness of God",
          "a": "Bethel Music"
        },
        {
          "t": "How Great Is Our God",
          "a": "Chris Tomlin"
        },
        {
          "t": "Gratitude",
          "a": "Brandon Lake"
        },
        {
          "t": "Hallelujah (Messiah)",
          "a": "G. F. Handel",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3f/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg/Handel_Messiah_Hallelujah_by_Oratorio_Chorus.ogg.mp3",
          "credit": "Handel Messiah Hallelujah by Oratorio Chorus.ogg (public domain)"
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan"
        },
        {
          "t": "Holy, Holy, Holy",
          "a": "Reginald Heber",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2f/Byrd_4-Part_Mass_-_Sanctus.ogg/Byrd_4-Part_Mass_-_Sanctus.ogg.mp3",
          "credit": "Byrd 4-Part Mass - Sanctus.ogg (cc by 3.0)"
        },
        {
          "t": "Gloria (Vivaldi)",
          "a": "Antonio Vivaldi",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fc/Vivaldi_Gloriapatri_DixitDominus_RV807_Esmuc.ogg/Vivaldi_Gloriapatri_DixitDominus_RV807_Esmuc.ogg.mp3",
          "credit": "Vivaldi Gloriapatri DixitDominus RV807 Esmuc.ogg (cc by-sa 4.0)"
        },
        {
          "t": "Thank You Lord",
          "a": "Chris Tomlin"
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
          "a": "Hymn"
        },
        {
          "t": "I Believe in Christ",
          "a": "Hymn"
        },
        {
          "t": "Jesus, the Very Thought of Thee",
          "a": "Hymn"
        },
        {
          "t": "Our Savior's Love",
          "a": "Hymn"
        },
        {
          "t": "This Is the Christ",
          "a": "Hymn"
        },
        {
          "t": "Look unto Christ",
          "a": "Hymn"
        },
        {
          "t": "Behold the Wounds in Jesus' Hands",
          "a": "Hymn"
        },
        {
          "t": "Oh, the Deep, Deep Love of Jesus",
          "a": "Hymn"
        },
        {
          "t": "Jesus, Once of Humble Birth",
          "a": "Hymn"
        },
        {
          "t": "Jesus of Nazareth, Savior and King",
          "a": "Hymn"
        },
        {
          "t": "Precious Savior, Dear Redeemer",
          "a": "Hymn"
        },
        {
          "t": "Beautiful Savior (Crusader's Hymn)",
          "a": "Primary"
        },
        {
          "t": "He Sent His Son",
          "a": "Primary"
        },
        {
          "t": "Jesus Once Was a Little Child",
          "a": "Primary"
        },
        {
          "t": "His Hands",
          "a": "Kenneth Cope"
        },
        {
          "t": "What a Beautiful Name",
          "a": "Hillsong Worship"
        },
        {
          "t": "O Divine Redeemer",
          "a": "Charles Gounod",
          "url": ""
        },
        {
          "t": "Lamb of God",
          "a": "Rob Gardner"
        },
        {
          "t": "The Holy City",
          "a": "Stephen Adams",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cf/The_Blue_Alsatian_Mountains_by_Michael_Maybrick.ogg/The_Blue_Alsatian_Mountains_by_Michael_Maybrick.ogg.mp3",
          "credit": "The Blue Alsatian Mountains by Michael Maybrick.ogg (public domain)"
        },
        {
          "t": "Jesus Paid It All",
          "a": "Kristian Stanfill"
        },
        {
          "t": "King of Kings",
          "a": "Hillsong Worship"
        },
        {
          "t": "Fairest Lord Jesus",
          "a": "Silesian folk hymn",
          "url": ""
        },
        {
          "t": "Crown Him with Many Crowns",
          "a": "Matthew Bridges",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/80/Crown_Him_with_many_Crowns.ogg/Crown_Him_with_many_Crowns.ogg.mp3",
          "credit": "Crown Him with many Crowns.ogg (cc by 3.0)"
        },
        {
          "t": "Jesus, Joy of Loving Hearts",
          "a": "Bernard of Clairvaux",
          "url": ""
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
          "a": "Hymn"
        },
        {
          "t": "Redeemer of Israel",
          "a": "Hymn"
        },
        {
          "t": "Sweet Is the Work",
          "a": "Hymn"
        },
        {
          "t": "High on the Mountain Top",
          "a": "Hymn"
        },
        {
          "t": "As Bread Is Broken",
          "a": "Hymn"
        },
        {
          "t": "Bread of Life, Living Water",
          "a": "Hymn"
        },
        {
          "t": "In Humility, Our Savior",
          "a": "Hymn"
        },
        {
          "t": "O God, the Eternal Father",
          "a": "Hymn"
        },
        {
          "t": "Sweet Hour of Prayer",
          "a": "Hymn"
        },
        {
          "t": "God, Our Father, Hear Us Pray",
          "a": "Hymn"
        },
        {
          "t": "While of These Emblems We Partake",
          "a": "Hymn"
        },
        {
          "t": "As I Keep the Sabbath Day",
          "a": "Hymn"
        },
        {
          "t": "Reverence Is Love",
          "a": "Primary"
        },
        {
          "t": "If Ye Love Me",
          "a": "Thomas Tallis",
          "url": ""
        },
        {
          "t": "Locus iste",
          "a": "Anton Bruckner",
          "url": ""
        },
        {
          "t": "Panis angelicus",
          "a": "César Franck",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Panis_Angelicus_-_Llanelli_Male_Voice_Choir.ogg/Panis_Angelicus_-_Llanelli_Male_Voice_Choir.ogg.mp3",
          "credit": "Panis Angelicus - Llanelli Male Voice Choir.ogg (cc by-sa 3.0)"
        },
        {
          "t": "Ave Maria",
          "a": "Franz Schubert",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6f/Franz_Schubert_-_Ellens_dritter_Gesang.oga/Franz_Schubert_-_Ellens_dritter_Gesang.oga.mp3",
          "credit": "Franz Schubert - Ellens dritter Gesang.oga (cc by 3.0)"
        },
        {
          "t": "O Magnum Mysterium",
          "a": "Morten Lauridsen"
        },
        {
          "t": "Holy, Holy, Holy",
          "a": "Reginald Heber",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0d/Holy%2C_Holy%2C_Holy.ogg/Holy%2C_Holy%2C_Holy.ogg.mp3",
          "credit": "Holy, Holy, Holy.ogg (cc by-sa 4.0)"
        },
        {
          "t": "Here I Am to Worship",
          "a": "Tim Hughes"
        },
        {
          "t": "Lord, Prepare Me to Be a Sanctuary",
          "a": "John W. Thompson"
        },
        {
          "t": "Cantique de Jean Racine",
          "a": "Gabriel Fauré",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/fe/Les_petits_chanteurs_de_Montigny_Cantique_de_Jean_Racine_%28Gabriel_Faure%29.ogg/Les_petits_chanteurs_de_Montigny_Cantique_de_Jean_Racine_%28Gabriel_Faure%29.ogg.mp3",
          "credit": "Les petits chanteurs de Montigny Cantique de Jean Racine (Gabriel Faure).ogg (cc by-sa 2.0)"
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
          "a": "Hymn"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn"
        },
        {
          "t": "Home Can Be a Heaven on Earth",
          "a": "Hymn"
        },
        {
          "t": "I Am a Child of God",
          "a": "Hymn"
        },
        {
          "t": "Each Life That Touches Ours for Good",
          "a": "Hymn"
        },
        {
          "t": "Love One Another",
          "a": "Hymn"
        },
        {
          "t": "Holding Hands Around the World",
          "a": "Hymn"
        },
        {
          "t": "Welcome Home",
          "a": "Hymn"
        },
        {
          "t": "God Be with You Till We Meet Again",
          "a": "Hymn"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary"
        },
        {
          "t": "Love Is Spoken Here",
          "a": "Primary"
        },
        {
          "t": "A Happy Family",
          "a": "Primary"
        },
        {
          "t": "Mother, I Love You",
          "a": "Primary"
        },
        {
          "t": "Daddy's Homecoming",
          "a": "Primary"
        },
        {
          "t": "Kindness Begins with Me",
          "a": "Primary"
        },
        {
          "t": "I'll Walk with You",
          "a": "Primary"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen"
        },
        {
          "t": "The Prayer",
          "a": "David Foster & Carole Bayer Sager"
        },
        {
          "t": "Bless This House",
          "a": "May H. Brahe",
          "url": ""
        },
        {
          "t": "Turn Around",
          "a": "Harry Belafonte"
        },
        {
          "t": "In My Life",
          "a": "The Beatles"
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
          "a": "Primary"
        },
        {
          "t": "Follow the Prophet",
          "a": "Primary"
        },
        {
          "t": "Book of Mormon Stories",
          "a": "Primary"
        },
        {
          "t": "I Love to See the Temple",
          "a": "Primary"
        },
        {
          "t": "Nephi's Courage",
          "a": "Primary"
        },
        {
          "t": "The Church of Jesus Christ",
          "a": "Primary"
        },
        {
          "t": "I Hope They Call Me on a Mission",
          "a": "Primary"
        },
        {
          "t": "When I Am Baptized",
          "a": "Primary"
        },
        {
          "t": "I Will Follow God's Plan",
          "a": "Primary"
        },
        {
          "t": "Choose the Right Way",
          "a": "Primary"
        },
        {
          "t": "Jesus Wants Me for a Sunbeam",
          "a": "Primary"
        },
        {
          "t": "Teach Me to Walk in the Light",
          "a": "Primary"
        },
        {
          "t": "Search, Ponder, and Pray",
          "a": "Primary"
        },
        {
          "t": "Scripture Power",
          "a": "Clive Romney"
        },
        {
          "t": "The Family Is of God",
          "a": "Matthew Neeley"
        },
        {
          "t": "Gethsemane",
          "a": "Hymn"
        },
        {
          "t": "I Know That My Savior Loves Me",
          "a": "Tami Jeppson Creamer"
        },
        {
          "t": "Popcorn Popping",
          "a": "Primary"
        },
        {
          "t": "Once There Was a Snowman",
          "a": "Primary"
        },
        {
          "t": "Give, Said the Little Stream",
          "a": "Primary"
        },
        {
          "t": "Do As I'm Doing",
          "a": "Primary"
        },
        {
          "t": "Hinges",
          "a": "Primary"
        },
        {
          "t": "Head, Shoulders, Knees, and Toes",
          "a": "Primary"
        },
        {
          "t": "My Heavenly Father Loves Me",
          "a": "Primary"
        },
        {
          "t": "The Wise Man and the Foolish Man",
          "a": "Primary"
        },
        {
          "t": "Samuel Tells of the Baby Jesus",
          "a": "Primary"
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
          "a": "Hymn"
        },
        {
          "t": "There Is Sunshine in My Soul Today",
          "a": "Hymn"
        },
        {
          "t": "The Morning Breaks",
          "a": "Hymn"
        },
        {
          "t": "Come, Ye Children of the Lord",
          "a": "Hymn"
        },
        {
          "t": "Let Zion in Her Beauty Rise",
          "a": "Hymn"
        },
        {
          "t": "Scatter Sunshine",
          "a": "Hymn"
        },
        {
          "t": "Have I Done Any Good?",
          "a": "Hymn"
        },
        {
          "t": "Today, While the Sun Shines",
          "a": "Hymn"
        },
        {
          "t": "Star Bright",
          "a": "Hymn"
        },
        {
          "t": "Jesus Wants Me for a Sunbeam",
          "a": "Primary"
        },
        {
          "t": "Morning Has Broken",
          "a": "Cat Stevens"
        },
        {
          "t": "This Is the Day",
          "a": "Les Garrett"
        },
        {
          "t": "Rise and Shine",
          "a": "Spiritual",
          "url": ""
        },
        {
          "t": "Every Morning",
          "a": "Hillsong Worship"
        },
        {
          "t": "New Wine",
          "a": "Hillsong Worship"
        },
        {
          "t": "Hallelujah Chorus (Mount of Olives)",
          "a": "Ludwig van Beethoven",
          "url": ""
        },
        {
          "t": "Morning Mood (Peer Gynt)",
          "a": "Edvard Grieg",
          "url": ""
        },
        {
          "t": "Awake, My Soul",
          "a": "Mumford & Sons"
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
          "a": "Hymn"
        },
        {
          "t": "Softly Now the Light of Day",
          "a": "Hymn"
        },
        {
          "t": "Now the Day Is Over",
          "a": "Hymn"
        },
        {
          "t": "Lord, We Ask Thee Ere We Part",
          "a": "Hymn"
        },
        {
          "t": "Sing We Now at Parting",
          "a": "Hymn"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn"
        },
        {
          "t": "The Day Dawn Is Breaking",
          "a": "Hymn"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary"
        },
        {
          "t": "I Feel My Savior's Love",
          "a": "Primary"
        },
        {
          "t": "Heavenly Father, Now I Pray",
          "a": "Primary"
        },
        {
          "t": "Nocturne (Chopin, Op. 9 No. 2)",
          "a": "Frédéric Chopin",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/89/Chopin_-_Nocturne_No._2_in_E-flat_major%2C_Op._9_No._2_%28Frank_Levy%29.flac/Chopin_-_Nocturne_No._2_in_E-flat_major%2C_Op._9_No._2_%28Frank_Levy%29.flac.mp3",
          "credit": "Chopin - Nocturne No. 2 in E-flat major, Op. 9 No. 2 (Frank Levy).flac (public domain)"
        },
        {
          "t": "Clair de lune",
          "a": "Claude Debussy",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5b/Clair_de_Lune_WikiOrchestra_backing_track_basses.ogg/Clair_de_Lune_WikiOrchestra_backing_track_basses.ogg.mp3",
          "credit": "Clair de Lune WikiOrchestra backing track basses.ogg (public domain)"
        },
        {
          "t": "Gymnopédie No. 1",
          "a": "Erik Satie",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/90/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg.mp3",
          "credit": "Erik Satie - gymnopedies - la 1 ere. lent et douloureux.ogg (public domain)"
        },
        {
          "t": "Sleep",
          "a": "Eric Whitacre"
        },
        {
          "t": "The Seal Lullaby",
          "a": "Eric Whitacre"
        },
        {
          "t": "Evening Prayer (Hansel and Gretel)",
          "a": "Engelbert Humperdinck",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/44/Evening_prayer.ogg/Evening_prayer.ogg.mp3",
          "credit": "Evening prayer.ogg (public domain)"
        },
        {
          "t": "All Through the Night",
          "a": "Welsh lullaby",
          "url": ""
        },
        {
          "t": "Goodnight My Angel",
          "a": "Billy Joel"
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
          "a": "Primary"
        },
        {
          "t": "Holy Places",
          "a": "Hymn"
        },
        {
          "t": "The Spirit of God",
          "a": "Hymn"
        },
        {
          "t": "Turn Your Hearts",
          "a": "Hymn"
        },
        {
          "t": "How Beautiful Thy Temples, Lord",
          "a": "Hymn"
        },
        {
          "t": "Rise, Ye Saints, and Temples Enter",
          "a": "Hymn"
        },
        {
          "t": "High on the Mountain Top",
          "a": "Hymn"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn"
        },
        {
          "t": "O My Father",
          "a": "Hymn"
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn"
        },
        {
          "t": "More Holiness Give Me",
          "a": "Hymn"
        },
        {
          "t": "Come, Lord Jesus",
          "a": "Hymn"
        },
        {
          "t": "Holy Ground",
          "a": "Geron Davis",
          "url": ""
        },
        {
          "t": "Sanctus (Requiem)",
          "a": "Gabriel Fauré",
          "url": ""
        },
        {
          "t": "How Lovely Is Thy Dwelling Place",
          "a": "Johannes Brahms",
          "url": ""
        },
        {
          "t": "I Was Glad",
          "a": "C. Hubert H. Parry",
          "url": ""
        },
        {
          "t": "Holy Is the Lord",
          "a": "Chris Tomlin"
        },
        {
          "t": "Take Me Into the Holy of Holies",
          "a": "Dave Browning"
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
          "a": "Hymn"
        },
        {
          "t": "I'll Go Where You Want Me to Go",
          "a": "Hymn"
        },
        {
          "t": "Go, Ye Messengers of Glory",
          "a": "Hymn"
        },
        {
          "t": "Hark, All Ye Nations!",
          "a": "Hymn"
        },
        {
          "t": "Israel, Israel, God Is Calling",
          "a": "Hymn"
        },
        {
          "t": "Ye Elders of Israel (Men)",
          "a": "Hymn"
        },
        {
          "t": "The Iron Rod",
          "a": "Hymn"
        },
        {
          "t": "Because I Have Been Given Much",
          "a": "Hymn"
        },
        {
          "t": "Have I Done Any Good?",
          "a": "Hymn"
        },
        {
          "t": "Let Us All Press On",
          "a": "Hymn"
        },
        {
          "t": "Go Forth with Faith",
          "a": "Hymn"
        },
        {
          "t": "I Hope They Call Me on a Mission",
          "a": "Primary"
        },
        {
          "t": "We'll Bring the World His Truth (Army of Helaman)",
          "a": "Primary"
        },
        {
          "t": "Called to Serve (Rob Gardner)",
          "a": "Rob Gardner"
        },
        {
          "t": "Go Light Your World",
          "a": "Chris Rice"
        },
        {
          "t": "Here I Am, Lord",
          "a": "Dan Schutte"
        },
        {
          "t": "The Summons (Will You Come and Follow Me)",
          "a": "John L. Bell"
        },
        {
          "t": "Send Me",
          "a": "Lecrae"
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
          "a": "Hymn"
        },
        {
          "t": "Secret Prayer",
          "a": "Hymn"
        },
        {
          "t": "Sweet Hour of Prayer",
          "a": "Hymn"
        },
        {
          "t": "Prayer Is the Soul's Sincere Desire",
          "a": "Hymn"
        },
        {
          "t": "I Need Thee Every Hour",
          "a": "Hymn"
        },
        {
          "t": "Father in Heaven",
          "a": "Hymn"
        },
        {
          "t": "Guide Us, O Thou Great Jehovah",
          "a": "Hymn"
        },
        {
          "t": "Be Thou Humble",
          "a": "Hymn"
        },
        {
          "t": "A Child's Prayer",
          "a": "Primary"
        },
        {
          "t": "I Pray in Faith",
          "a": "Primary"
        },
        {
          "t": "The Lord's Prayer",
          "a": "Albert Hay Malotte",
          "url": ""
        },
        {
          "t": "Pater noster",
          "a": "Igor Stravinsky",
          "url": ""
        },
        {
          "t": "Ubi caritas",
          "a": "Maurice Duruflé",
          "url": ""
        },
        {
          "t": "Prayer of Saint Francis",
          "a": "Sebastian Temple"
        },
        {
          "t": "Hear My Prayer, O Lord",
          "a": "Henry Purcell",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ee/Purcell_hear_my_prayer%2C_o_lord.ogg/Purcell_hear_my_prayer%2C_o_lord.ogg.mp3",
          "credit": "Purcell hear my prayer, o lord.ogg (cc by-sa 1.0)"
        },
        {
          "t": "What a Friend We Have in Jesus",
          "a": "Joseph M. Scriven",
          "url": ""
        },
        {
          "t": "Nearer, My God, to Thee",
          "a": "Hymn"
        },
        {
          "t": "Lord, Listen to Your Children Praying",
          "a": "Ken Medema"
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
          "a": "Hymn"
        },
        {
          "t": "God Be with You Till We Meet Again",
          "a": "Hymn"
        },
        {
          "t": "O My Father",
          "a": "Hymn"
        },
        {
          "t": "Abide with Me!",
          "a": "Hymn"
        },
        {
          "t": "Where Can I Turn for Peace?",
          "a": "Hymn"
        },
        {
          "t": "Be Still, My Soul",
          "a": "Hymn"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn"
        },
        {
          "t": "Families Can Be Together Forever",
          "a": "Hymn"
        },
        {
          "t": "Come, Come, Ye Saints",
          "a": "Hymn"
        },
        {
          "t": "My Redeemer Lives",
          "a": "Hymn"
        },
        {
          "t": "Behold the Wounds in Jesus' Hands",
          "a": "Hymn"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman"
        },
        {
          "t": "Homeward Bound",
          "a": "Marta Keen"
        },
        {
          "t": "Going Home",
          "a": "Antonín Dvořák",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/74/%22Goin%27_Home%22%2C_performed_by_the_United_States_Air_Force_Band.oga/%22Goin%27_Home%22%2C_performed_by_the_United_States_Air_Force_Band.oga.mp3",
          "credit": "\"Goin' Home\", performed by the United States Air Force Band.oga (public domain)"
        },
        {
          "t": "Pie Jesu",
          "a": "Gabriel Fauré",
          "url": ""
        },
        {
          "t": "In paradisum (Requiem)",
          "a": "Gabriel Fauré",
          "url": ""
        },
        {
          "t": "Lacrimosa (Requiem)",
          "a": "W. A. Mozart",
          "url": ""
        },
        {
          "t": "It Is Well with My Soul",
          "a": "Horatio Spafford"
        },
        {
          "t": "I Will Rise",
          "a": "Chris Tomlin"
        },
        {
          "t": "Homesick",
          "a": "MercyMe"
        },
        {
          "t": "See You Again",
          "a": "Carrie Underwood"
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
          "a": "Hymn"
        },
        {
          "t": "They, the Builders of the Nation",
          "a": "Hymn"
        },
        {
          "t": "Carry On",
          "a": "Hymn"
        },
        {
          "t": "Zion Stands with Hills Surrounded",
          "a": "Hymn"
        },
        {
          "t": "For the Strength of the Hills",
          "a": "Hymn"
        },
        {
          "t": "Our Mountain Home So Dear",
          "a": "Hymn"
        },
        {
          "t": "Faith in Every Footstep",
          "a": "Hymn"
        },
        {
          "t": "Pioneer Children Sang As They Walked",
          "a": "Primary"
        },
        {
          "t": "To Be a Pioneer",
          "a": "Primary"
        },
        {
          "t": "Whenever I Think about Pioneers",
          "a": "Primary"
        },
        {
          "t": "Little Pioneer Children (Round)",
          "a": "Primary"
        },
        {
          "t": "The Handcart Song",
          "a": "Pioneer song"
        },
        {
          "t": "Faith in Every Footstep (Choir)",
          "a": "K. Newell Dayley"
        },
        {
          "t": "All Is Well (Come, Come, Ye Saints)",
          "a": "Tabernacle Choir at Temple Square"
        },
        {
          "t": "Shenandoah",
          "a": "American folk song",
          "url": "https://upload.wikimedia.org/wikipedia/commons/4/47/Shenandoah_-_Singing_Sergeants_-_United_States_Air_Force_Band.mp3?utm_source=commons.wikimedia.org&utm_campaign=api&utm_content=original",
          "credit": "Shenandoah - Singing Sergeants - United States Air Force Band.mp3 (public domain)"
        },
        {
          "t": "Simple Gifts",
          "a": "Shaker song"
        },
        {
          "t": "Wayfaring Stranger",
          "a": "American folk song",
          "url": ""
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
          "credit": "Handel Messiah Hallelujah by Oratorio Chorus.ogg (public domain)"
        },
        {
          "t": "The Spirit of God",
          "a": "Hymn"
        },
        {
          "t": "Come, Thou Fount of Every Blessing",
          "a": "Hymn"
        },
        {
          "t": "Battle Hymn of the Republic",
          "a": "Tabernacle Choir at Temple Square"
        },
        {
          "t": "O Divine Redeemer",
          "a": "Charles Gounod",
          "url": ""
        },
        {
          "t": "Betelehemu",
          "a": "Nigerian carol"
        },
        {
          "t": "Consider the Lilies",
          "a": "Roger Hoffman"
        },
        {
          "t": "The Lord Bless You and Keep You",
          "a": "John Rutter"
        },
        {
          "t": "For the Beauty of the Earth",
          "a": "John Rutter"
        },
        {
          "t": "O Magnum Mysterium",
          "a": "Morten Lauridsen"
        },
        {
          "t": "Ave Maria",
          "a": "Franz Biebl"
        },
        {
          "t": "Sicut cervus",
          "a": "G. P. da Palestrina",
          "url": ""
        },
        {
          "t": "Miserere mei, Deus",
          "a": "Gregorio Allegri",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d7/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg/Allegri_-_Miserere_Mei%2C_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_%28audio%29.ogg.mp3",
          "credit": "Allegri - Miserere Mei, Deus - Ensamble Escénico Vocal (audio).ogg (cc by 3.0)"
        },
        {
          "t": "Spem in alium",
          "a": "Thomas Tallis",
          "url": ""
        },
        {
          "t": "Nearer, My God, to Thee (BYU Vocal Point)",
          "a": "BYU Vocal Point"
        },
        {
          "t": "Requiem: Pie Jesu",
          "a": "Andrew Lloyd Webber"
        },
        {
          "t": "The Ground (Sunrise Mass)",
          "a": "Ola Gjeilo"
        },
        {
          "t": "Northern Lights",
          "a": "Ola Gjeilo"
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
          "a": "Hymn"
        },
        {
          "t": "How Firm a Foundation",
          "a": "Hymn"
        },
        {
          "t": "Testimony",
          "a": "Hymn"
        },
        {
          "t": "The Iron Rod",
          "a": "Hymn"
        },
        {
          "t": "I Know That My Redeemer Lives",
          "a": "Hymn"
        },
        {
          "t": "Lead, Kindly Light",
          "a": "Hymn"
        },
        {
          "t": "Guide Us, O Thou Great Jehovah",
          "a": "Hymn"
        },
        {
          "t": "A Mighty Fortress Is Our God",
          "a": "Hymn"
        },
        {
          "t": "I Will Walk with Jesus",
          "a": "Hymn"
        },
        {
          "t": "Faith",
          "a": "Primary"
        },
        {
          "t": "I Know My Father Lives",
          "a": "Primary"
        },
        {
          "t": "Search, Ponder, and Pray",
          "a": "Primary"
        },
        {
          "t": "Oceans (Where Feet May Fail)",
          "a": "Hillsong United"
        },
        {
          "t": "Build My Life",
          "a": "Housefires"
        },
        {
          "t": "Trust in You",
          "a": "Lauren Daigle"
        },
        {
          "t": "Blessed Assurance",
          "a": "Fanny Crosby",
          "url": ""
        },
        {
          "t": "Great Is Thy Faithfulness",
          "a": "Chisholm & Runyan"
        },
        {
          "t": "Waymaker",
          "a": "Leeland"
        },
        {
          "t": "Even If",
          "a": "MercyMe"
        },
        {
          "t": "Believe for It",
          "a": "CeCe Winans"
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
          "a": "Hymn"
        },
        {
          "t": "Joy to the World",
          "a": "Hymn"
        },
        {
          "t": "O Little Town of Bethlehem",
          "a": "Hymn"
        },
        {
          "t": "Far, Far Away on Judea's Plains",
          "a": "Hymn"
        },
        {
          "t": "Away in a Manger",
          "a": "Hymn"
        },
        {
          "t": "Hark! The Herald Angels Sing",
          "a": "Hymn"
        },
        {
          "t": "Oh, Come, All Ye Faithful",
          "a": "Hymn"
        },
        {
          "t": "With Wondering Awe",
          "a": "Hymn"
        },
        {
          "t": "He Is Born, the Divine Christ Child",
          "a": "Hymn"
        },
        {
          "t": "Still, Still, Still",
          "a": "Hymn"
        },
        {
          "t": "What Child Is This?",
          "a": "Hymn"
        },
        {
          "t": "Once in Royal David's City",
          "a": "Hymn"
        },
        {
          "t": "It Came upon the Midnight Clear",
          "a": "Hymn"
        },
        {
          "t": "The First Noel",
          "a": "Hymn"
        },
        {
          "t": "Angels We Have Heard on High",
          "a": "Hymn"
        },
        {
          "t": "Samuel Tells of the Baby Jesus",
          "a": "Primary"
        },
        {
          "t": "Stars Were Gleaming",
          "a": "Primary"
        },
        {
          "t": "The Nativity Song",
          "a": "Primary"
        },
        {
          "t": "O Holy Night",
          "a": "Adolphe Adam"
        },
        {
          "t": "O Come, O Come, Emmanuel",
          "a": "Plainsong",
          "url": ""
        },
        {
          "t": "In the Bleak Midwinter",
          "a": "Gustav Holst",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8a/Gustav_Theodore_Holst_-_In_the_Bleak_Midwinter_-_%28A_Christmas_Carol%29.ogg/Gustav_Theodore_Holst_-_In_the_Bleak_Midwinter_-_%28A_Christmas_Carol%29.ogg.mp3",
          "credit": "Gustav Theodore Holst - In the Bleak Midwinter - (A Christmas Carol).ogg (public domain)"
        },
        {
          "t": "Mary, Did You Know?",
          "a": "Mark Lowry & Buddy Greene",
          "url": ""
        },
        {
          "t": "Breath of Heaven (Mary's Song)",
          "a": "Amy Grant"
        },
        {
          "t": "Carol of the Bells",
          "a": "Mykola Leontovych",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6b/Shchedryk%27s_%22Carol_of_the_Bells%22_%281922%29.oga/Shchedryk%27s_%22Carol_of_the_Bells%22_%281922%29.oga.mp3",
          "credit": "Shchedryk's \"Carol of the Bells\" (1922).oga (public domain)"
        },
        {
          "t": "Gesù bambino",
          "a": "Pietro Yon",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7c/U.S._Army_Band_-_Ges%C3%B9_Bambino.ogg/U.S._Army_Band_-_Ges%C3%B9_Bambino.ogg.mp3",
          "credit": "U.S. Army Band - Gesù Bambino.ogg (public domain)"
        },
        {
          "t": "Betelehemu",
          "a": "Nigerian carol"
        },
        {
          "t": "Candlelight Carol",
          "a": "John Rutter"
        },
        {
          "t": "Little Drummer Boy",
          "a": "Katherine K. Davis",
          "url": ""
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
          "a": "Hymn"
        },
        {
          "t": "There Is a Green Hill Far Away",
          "a": "Hymn"
        },
        {
          "t": "Behold the Great Redeemer Die",
          "a": "Hymn"
        },
        {
          "t": "Upon the Cross of Calvary",
          "a": "Hymn"
        },
        {
          "t": "He Is Risen!",
          "a": "Hymn"
        },
        {
          "t": "Christ the Lord Is Risen Today",
          "a": "Hymn"
        },
        {
          "t": "That Easter Morn",
          "a": "Hymn"
        },
        {
          "t": "My Redeemer Lives",
          "a": "Hymn"
        },
        {
          "t": "Hail the Day That Sees Him Rise",
          "a": "Hymn"
        },
        {
          "t": "Jesus Has Risen",
          "a": "Primary"
        },
        {
          "t": "Did Jesus Really Live Again?",
          "a": "Primary"
        },
        {
          "t": "Easter Hosanna",
          "a": "Primary"
        },
        {
          "t": "Were You There?",
          "a": "Spiritual",
          "url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d6/01._Patrick_Kilpatrick_-_Did_you_jump_or_were_you_dropped.ogg/01._Patrick_Kilpatrick_-_Did_you_jump_or_were_you_dropped.ogg.mp3",
          "credit": "01. Patrick Kilpatrick - Did you jump or were you dropped.ogg (cc0)"
        },
        {
          "t": "I Know That My Redeemer Liveth",
          "a": "G. F. Handel",
          "url": ""
        },
        {
          "t": "Because He Lives",
          "a": "Bill & Gloria Gaither"
        },
        {
          "t": "Easter Hymn (Cavalleria rusticana)",
          "a": "Pietro Mascagni",
          "url": ""
        },
        {
          "t": "Living Hope",
          "a": "Phil Wickham"
        },
        {
          "t": "Glorious Day",
          "a": "Passion"
        },
        {
          "t": "Resurrection Power",
          "a": "Chris Tomlin"
        },
        {
          "t": "Lamb of God: Gloria",
          "a": "Rob Gardner"
        },
        {
          "t": "Christ Is Risen",
          "a": "Matt Maher"
        }
      ]
    }
  ]
}
```
