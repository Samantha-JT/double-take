[![Double Take](https://badgen.net/github/release/jakowenko/double-take/stable)](https://github.com/jakowenko/double-take) [![Double Take](https://badgen.net/github/stars/jakowenko/double-take)](https://github.com/jakowenko/double-take/stargazers) [![Docker Pulls](https://flat.badgen.net/docker/pulls/jakowenko/double-take)](https://hub.docker.com/r/jakowenko/double-take) [![Discord](https://flat.badgen.net/discord/members/3pumsskdN5?label=Discord)](https://discord.gg/3pumsskdN5)

# Double Take

Unified UI and API for processing and training images for facial recognition.

<p align="center">
  <img src="https://user-images.githubusercontent.com/1081811/126434926-cf2275f7-f3a8-43eb-adc2-903c0071f7d1.jpg" width="100%">
</p>

## Why?

There's a lot of great open source software to perform facial recognition, but each of them behave differently. Double Take was created to abstract the complexities of the detection services and combine them into an easy to use UI and API.

## Features

- UI and API bundled into single Docker image
- Ability to password protect UI and API
- Support for multiple detectors
- Train and untrain images for subjects
- Process images from NVRs
- Publish results to MQTT topics
- REST API can be invoked by other applications

### Supported Detectors

- [DeepStack](https://deepstack.cc) v2021.02.1-2021.06.01
- [CompreFace](https://github.com/exadel-inc/CompreFace) v0.5.0-0.6.0
- [Facebox](https://machinebox.io)

### Supported NVRs

- [Frigate](https://github.com/blakeblackshear/frigate) v0.8.0-0.9.0

## Integrations

### [Frigate](https://github.com/blakeblackshear/frigate)

Subscribe to Frigate's MQTT topics and process images for analysis.

```yaml
mqtt:
  host: localhost

frigate:
  url: http://localhost:5000
```

When the `frigate/events` topic is updated the API begins to process the [`snapshot.jpg`](https://blakeblackshear.github.io/frigate/usage/api/#apieventsidsnapshotjpg) and [`latest.jpg`](https://blakeblackshear.github.io/frigate/usage/api/#apicamera_namelatestjpgh300) images from Frigate's API. These images are passed from the API to the configured detector(s) until a match is found that meets the configured requirements. To improve the chances of finding a match, the processing of the images will repeat until the amount of retries is exhausted or a match is found.

When the `frigate/+/person/snapshot` topic is updated the API will process that image with the configured detector(s). It is recommended to increase the MQTT snapshot size in the [Frigate camera config](https://blakeblackshear.github.io/frigate/configuration/cameras#full-example).

```yaml
cameras:
  front-door:
    mqtt:
      timestamp: False
      bounding_box: False
      crop: True
      height: 500
```

If a match is found the image is saved to `/.storage/matches/${filename}`.

### [Home Assistant](https://www.home-assistant.io)

Trigger automations / notifications when images are processed.

If the MQTT integration is configured within Home Assistant, then sensors will automatically be created.

#### Notification Automation

This notification will work for both matches and unknown results. The message can be customized with any of the attributes from the entity.

```yaml
alias: Notify
trigger:
  - platform: state
    entity_id: sensor.double_take_david
  - platform: state
    entity_id: sensor.double_take_unknown
condition:
  - condition: template
    value_template: '{{ trigger.to_state.state != trigger.from_state.state }}'
action:
  - service: notify.mobile_app
    data:
      message: |-
        {% if trigger.to_state.attributes.match is defined %}
          {{trigger.to_state.attributes.friendly_name}} is near the {{trigger.to_state.state}} @ {{trigger.to_state.attributes.match.confidence}}% by {{trigger.to_state.attributes.match.detector}}:{{trigger.to_state.attributes.match.type}} taking {{trigger.to_state.attributes.attempts}} attempt(s) @ {{trigger.to_state.attributes.duration}} sec
        {% elif trigger.to_state.attributes.unknown is defined %}
          unknown is near the {{trigger.to_state.state}} @ {{trigger.to_state.attributes.unknown.confidence}}% by {{trigger.to_state.attributes.unknown.detector}}:{{trigger.to_state.attributes.unknown.type}} taking {{trigger.to_state.attributes.attempts}} attempt(s) @ {{trigger.to_state.attributes.duration}} sec
        {% endif %}
      data:
        attachment:
          url: |-
            {% if trigger.to_state.attributes.match is defined %}
              http://192.168.1.2:3000/api/storage/matches/{{trigger.to_state.attributes.match.filename}}?box=true&token={{trigger.to_state.attributes.token}}
            {% elif trigger.to_state.attributes.unknown is defined %}
               http://192.168.1.2:3000/api/storage/matches/{{trigger.to_state.attributes.unknown.filename}}?box=true&token={{trigger.to_state.attributes.token}}
            {% endif %}
        actions:
          - action: URI
            title: View Image
            uri: |-
              {% if trigger.to_state.attributes.match is defined %}
                http://192.168.1.2:3000/api/storage/matches/{{trigger.to_state.attributes.match.filename}}?box=true&token={{trigger.to_state.attributes.token}}
              {% elif trigger.to_state.attributes.unknown is defined %}
                 http://192.168.1.2:3000/api/storage/matches/{{trigger.to_state.attributes.unknown.filename}}?box=true&token={{trigger.to_state.attributes.token}}
              {% endif %}
mode: parallel
max: 10
```

### MQTT

Publish results to `double-take/matches/${name}` and `double-take/cameras/${camera}`. The number of results will also be published to `double-take/cameras/${camera}/person` and will reset back to `0` after 30 seconds.

Errors from the API will be published to `double-take/errors`.

```yaml
mqtt:
  host: localhost
```

#### double-take/matches/david

```json
{
  "id": "1623906078.684285-5l9hw6",
  "duration": 1.26,
  "timestamp": "2021-06-17T05:01:36.030Z",
  "attempts": 3,
  "camera": "living-room",
  "zones": [],
  "match": {
    "name": "david",
    "confidence": 66.07,
    "match": true,
    "box": { "top": 308, "left": 1018, "width": 164, "height": 177 },
    "type": "latest",
    "duration": 0.28,
    "detector": "compreface",
    "filename": "2f07d1ad-9252-43fd-9233-2786a36a15a9.jpg"
  }
}
```

#### double-take/cameras/back-door

```json
{
  "id": "ff894ff3-2215-4cea-befa-43fe00898b65",
  "duration": 4.25,
  "timestamp": "2021-06-17T03:19:55.695Z",
  "attempts": 5,
  "camera": "back-door",
  "zones": [],
  "matches": [
    {
      "name": "david",
      "confidence": 100,
      "match": true,
      "box": { "top": 286, "left": 744, "width": 319, "height": 397 },
      "type": "manual",
      "duration": 0.8,
      "detector": "compreface",
      "filename": "4d8a14a9-96c5-4691-979b-0f2325311453.jpg"
    }
  ]
}
```

## Notify Services

### [Gotify](https://gotify.net)

```yaml
notify:
  gotify:
    url: http://localhost:8080
    token:
```

## UI

The UI is accessible from `http://localhost:3000`.

- Matches: `/`
- Train: `/train`
- Config: `/config`
- Access Tokens: `/tokens` (_if authentication is enabled_)

## Authentication

Enable authentication to password protect the UI. This is recommended if running Double Take behind a reverse proxy which is exposed to the internet.

```yaml
auth: true
```

## API

Documentation can be viewed on [Postman](https://documenter.getpostman.com/view/1013188/TzsWuAa8).

## Usage

### Docker Compose

```yaml
version: '3.7'

volumes:
  double-take:

services:
  double-take:
    container_name: double-take
    image: jakowenko/double-take
    restart: unless-stopped
    volumes:
      - double-take:/.storage
    ports:
      - 3000:3000
```

## Configuration

Configurable options that can be passed by mounting a file at `/double-take/config.yml` and is editable via the UI at `http://localhost:3000/config`. _Default values do not need to be specified in configuration unless they need to be overwritten._

### `auth`

```yaml
# enable authentication for ui and api (default: shown below)
auth: false
```

### `token`

```yaml
# if authentication is enabled
# age of access token in api response and mqtt topics (default: shown below)
# expressed in seconds or a string describing a time span zeit/ms
# https://github.com/vercel/ms
token:
  image: 24h
```

### `mqtt`

```yaml
# enable mqtt subscribing and publishing (default: shown below)
mqtt:
  host:
  username:
  password:

  topics:
    # mqtt topic for frigate message subscription
    frigate: frigate/events
    #  mqtt topic for home assistant discovery subscription
    homeassistant: homeassistant
    # mqtt topic where matches are published by name
    matches: double-take/matches
    # mqtt topic where matches are published by camera name
    cameras: double-take/cameras
```

### `detect`

```yaml
# global detect settings (default: shown below)
detect:
  match:
    # save match images
    save: true
    # include base64 encoded string in api results and mqtt messages
    # options: true, false, box
    base64: false
    # minimum confidence needed to consider a result a match
    confidence: 60
    # hours to keep match images until they are deleted
    purge: 168
    # minimum area in pixels to consider a result a match
    min_area: 10000

  unknown:
    # save unknown images
    save: true
    # include base64 encoded string in api results and mqtt messages
    # options: true, false, box
    base64: false
    # minimum confidence needed before classifying a name as unknown
    confidence: 40
    # hours to keep unknown images until they are deleted
    purge: 8
    # minimum area in pixels to keep an unknown result
    min_area: 0
```

### `frigate`

```yaml
# frigate settings (default: shown below)
frigate:
  url:

  # object labels that are allowed for facial recognition
  labels:
    - person

  attempts:
    # number of times double take will request a frigate latest.jpg for facial recognition
    latest: 10
    # number of times double take will request a frigate snapshot.jpg for facial recognition
    snapshot: 0
    # process frigate images from frigate/+/person/snapshot topics
    mqtt: true
    # add a delay expressed in seconds between each detection loop
    delay: 0

  image:
    # height of frigate image passed for facial recognition
    height: 500

  # only process images from specific cameras
  cameras:
    # - front-door
    # - garage

  # only process images from specific zones
  zones:
    # - camera: garage
    #   zone: driveway

  # override frigate attempts and image per camera
  events:
    # front-door:
    #   attempts:
    #     # number of times double take will request a frigate latest.jpg for facial recognition
    #     latest: 5
    #     # number of times double take will request a frigate snapshot.jpg for facial recognition
    #     snapshot: 5
    #     # process frigate images from frigate/<camera-name>/person/snapshot topic
    #     mqtt: false
    #     # add a delay expressed in seconds between each detection loop
    #     delay: 1

    #   image:
    #     # height of frigate image passed for facial recognition (only if using default latest.jpg and snapshot.jpg)
    #     height: 1000
    #     # custom image that will be used in place of latest.jpg
    #     latest: http://camera-url.com/image.jpg
    #     # custom image that will be used in place of snapshot.jpg
    #     snapshot: http://camera-url.com/image.jpg
```

### `cameras`

```yaml
# camera settings (default: shown below)
cameras:
  front-door:
    # apply masks before processing image
    # masks:
    #   # list of x,y coordinates to define the polygon of the zone
    #   coordinates:
    #     - 1920,0,1920,328,1638,305,1646,0
    #   # show the mask on the final saved image (helpful for debugging)
    #   visible: false
    #   # size of camera stream used in resizing masks
    #   size: 1920x1080

    # override global detect variables per camera
    # detect:
    #   match:
    #     # save match images
    #     save: true
    #     # include base64 encoded string in api results and mqtt messages
    #     # options: true, false, box
    #     base64: false
    #     # minimum confidence needed to consider a result a match
    #     confidence: 60
    #     # minimum area in pixels to consider a result a match
    #     min_area: 10000

    #   unknown:
    #     # save unknown images
    #     save: true
    #     # include base64 encoded string in api results and mqtt messages
    #     # options: true, false, box
    #     base64: false
    #     # minimum confidence needed before classifying a match name as unknown
    #     confidence: 40
    #     # minimum area in pixels to keep an unknown result
    #     min_area: 0

    # snapshot:
    #   # process any jpeg encoded mqtt topic for facial recognition
    #   topic:
    #   # process any http image for facial recognition
    #   url:
```

### `detectors`

```yaml
# detector settings (default: shown below)
detectors:
  compreface:
    url:
    key:
    # number of seconds before the request times out and is aborted
    timeout: 15
    # minimum required confidence that a recognized face is actually a face
    # value is between 0.0 and 1.0
    det_prob_threshold: 0.8
    # comma-separated slugs of face plugins
    # https://github.com/exadel-inc/CompreFace/blob/master/docs/Face-services-and-plugins.md)
    # face_plugins: mask,gender,age

  deepstack:
    url:
    key:
    # number of seconds before the request times out and is aborted
    timeout: 15

  facebox:
    url:
    # number of seconds before the request times out and is aborted
    timeout: 15
```

### `notify`

```yaml
# notify settings (default: shown below)
notify:
  gotify:
    url:
    token:
    priority: 5

    # only notify from specific cameras
    # cameras:
    #   - front-door
    #   - garage

    # only notify from specific zones
    # zones:
    #   - camera: garage
    #     zone: driveway
```

### `time`

```yaml
# time settings (default: shown below)
time:
  # defaults to iso 8601 format with support for token-based formatting
  # https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
  format:
  # time zone used in logs
  timezone: UTC
```

### `logs`

```yaml
# log settings (default: shown below)
# options: silent, error, warn, info, http, verbose, debug, silly
logs:
  level: info
```

### `ui`

```yaml
# ui settings (default: shown below)
ui:
  pagination:
    # number of results per page
    limit: 50

  thumbnails:
    # value between 0-100
    quality: 80
    # value in pixels
    width: 300
```

## Development

### Run Local Containers

| Service |                  |
| ------- | ---------------- |
| UI      | `localhost:8080` |
| API     | `localhost:3000` |
| MQTT    | `localhost:1883` |

```bash
# start development containers
./.develop/docker up

# remove development containers
./.develop/docker down
```

### Build Local Image

```bash
./.develop/build
```

## Donations

If you would like to make a donation to support development, please use [GitHub Sponsors](https://github.com/sponsors/jakowenko).
