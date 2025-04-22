Now, I want to be able to add more than just youtube videos. If I add text that's not a youtube video, make it a card like the current title cards, meaning, it's not numbered.
But the title cards have bold text. For these, I want regular text.
Each paragraph becomes a new card.

----

* For this we currently get the standard title and the card
https://www.youtube.com/watch?v=DI-LKs3GpeE&ab_channel=UniversalAGI

* if i add it with a title argument, the title should be shown as I enter it
The syntax is
[Title]Link

For this, the video title shown before the card is "Video title"
[Video title]https://www.youtube.com/watch?v=DI-LKs3GpeE&ab_channel=UniversalAGI

* If I add a youtube link with an empty video title, it doesn't show the video's title before the card

For this we get only the card, no title box for this video.
[]https://www.youtube.com/watch?v=DI-LKs3GpeE&ab_channel=UniversalAGI


----

"Edit links" now takes only the first half of the container horizontally. To its right, add "Link to share", same functionaly of the existing "Link to share" button.

----
If two subsequent links come from the same video, I only want to see the title once.

So this:
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
1 4:17 - 4:30
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
2 8:07 - 8:22

Should be this
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
1 4:17 - 4:30
2 8:07 - 8:22
----

"Youtube viewer" should be resized as necessary to ensure it fits into a single line. I don't want it wrapping. I don't want ellipsis, i want the font to become smaller to fit the whole text.

----

Entered this

https://www.youtube.com/embed/DI-LKs3GpeE?start=257&end=270
https://www.youtube.com/watch?v=b4QIaBMvZqc&ab_channel=MateusStarling
https://www.youtube.com/embed/DI-LKs3GpeE?start=452&end=465


Got this

Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
4:17 - 4:30
FUSION BAIÃO | Mateus Starling Quarteto | QUINTO
0:00 - 3:58
7:32 - 7:45

From the cards, it looks like the last two links are to the same video, but THEY ARE NOT.

Expected outcome:Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
4:17 - 4:30
FUSION BAIÃO | Mateus Starling Quarteto | QUINTO
0:00 - 3:58
Expected outcome:Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
7:32 - 7:45

----

I want cards to be numbered. But if there's a new video, the numbering continues from the last.

So this input
https://www.youtube.com/embed/DI-LKs3GpeE?start=257&end=270
https://www.youtube.com/watch?v=b4QIaBMvZqc&ab_channel=MateusStarling
https://www.youtube.com/embed/DI-LKs3GpeE?start=452&end=465

Yields this output
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
1 [Play button] 4:17 - 4:30

FUSION BAIÃO | Mateus Starling Quarteto | QUINTO
2 [Play button] 4:17 - 4:30

Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
3 [Play button] 7:32 - 7:45

----

"Edit links" should be BELOW "built by pedro diniz", not at the same vertical level.. But add some margin.
It should be as tall as "Go" and "Get link".

Before, we were fetching video titles. Then I asked you to allow me to click and edit, but since then, the video titles aren't being fetched and shown anymore. Let me be very clear.
* The user sees the title of the video as fetched. If they click it, they can edit it. But the title MUST be there to begin with.



----
I said this, but I still want the default to be the video titled fetched from youtube!!!

Make it so that if I click the title of the video above the cards, I can edit it. Some videos have unnecessarily long names, but I want to give the user power to choose how it's shown.
----
If I have links created, the input box goes away and instead, we get a "Enter new links" button, to make it come back.
----
Now, instead of the card showing the link, say "https://www.youtube.com/embed/DI-LKs3GpeE?start=257&end=270", if there are time stamps, it will translate those into minutes and seconds. So, for that, it would simply show as "4:17 - 4:30"
If there's only a start parameter, like "https://www.youtube.com/embed/DI-LKs3GpeE?start=257", then show "4:17 -"
----
I could enter links to multiple videos. Above the cards for a given video, show me the video's title. I DON'T WANT you to agglutinate cards into the same video, but rather to show them in the order entered

So if I add

https://www.youtube.com/embed/DI-LKs3GpeE?start=257&end=270
https://www.youtube.com/watch?v=b4QIaBMvZqc&ab_channel=MateusStarling
https://www.youtube.com/embed/DI-LKs3GpeE?start=452&end=465

The output should be 
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
Card 1

FUSION BAIÃO | Mateus Starling Quarteto | QUINTO
Card 2

Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
Card 3


And not 
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
Card 1
Card 3

FUSION BAIÃO | Mateus Starling Quarteto | QUINTO
Card 2


Also, the encoding isn't matching. Please fix that
The video name is:
Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI
I'm getting:
Former Google CEO: &quot;China Will Win AI Race Unless We Act Now&quot; | Founder Psychology, Talent Wars, AI