/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 3/31/2015
 * Project: backpak
 * 
 * This is the default configuration settings for the backpak api framework
 * 
 */

module.exports = {
    transport: {
        socket: {
            port: 8123,
        },
        ws: {
            port: 8124,
        },
        chunked: {
            port: 8125,
        },
        rest: {
            port: 8126,
        }
    },
    cluster: {
        enabled: true,
    },
    logger: {
        debug: console.log,
        info: console.log,
        warn: console.log,
        error: console.log,
    },
    beacon: {
        enabled: false,
        port: 8139,
    },
    cache: {
        type: 'redis',
        server: {
            port: 6379,
            host: 'localhost',
        },
    },
    serverKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0N9gBsy9gm22/PRwQ0dGa/D19N46tES/zsbeRKvxul0GANVt\nk1GGDhCOEUESv0kkdJdzoAEGxoR9Gdcxryj8apjDSRnrhfv3CpOKQ0WtkgkiaVP2\neZtcrLszb8yHVL6gfwze6jj4LzaT5yTmtV6eaXT9zfB53QKxWsIn3AB5wq3/gxMw\nhWbY8huhuE/BWYO3jE7qeVtaPsJwmSATsLJVDXyR576919t325hf66Qslxx/dL9G\nPr5THKEmLmrGZbuHxerNmvTgZFJK23GJzW2EYkuLpWy4IBwNQo8dnrjk2jqF4m8U\nw7R6xuUmpiRhH+YeIo1RH1lyFX0nz3qzYW6rYQIDAQABAoIBAD/AXgvVQ+ZiXF66\nsOUoBQt/IWMazSombbDMLB0jqgUqzWFFw0sar+LtFJ+ZkAJIbdMUQttMVOgUmiZf\n8y82QEy80aYnPibH7/APdjzwMHkJRrKFSQ526ANko990ur2X7V656/PrbXzjmKMN\nNUmYVptzdN/9jQRzBPThm87fakqLyd1vvsRzhpHKrapVCSQSu5r2HMhwspf0we4S\n5dSuxbzLEHEnRGo0Vnd12dSJ+FInEOMtQyMt6airR4Xov73JFryeTfbKMo0ZtsbG\n1cc37gVpu+2K6m6y8zwfGze8Q13vYsU4H/yhJtNrm8DpsttGqeAUggocEYHXbz0C\n3hMzNb0CgYEA7rAiDZK2IoE1N2TdlSfadNRGLjlDTGdHuPsH2R9tEELGrPzS1V23\nYR9SrCfmOjvD0o/Yzn7Y9kW4BLiOplV9oiBPvIf7xo3G6FMIuvf+NvtTrdr/8seR\nLszsjBqx/Y48TpMBbYjioSIG4fBzwxKFT7yKJhf3xnAl3xkJkYZASDMCgYEA4AWj\n3zSLoug2oLr/w7jMN17zRrfxG+yNpaa1v6+Hwx1MkCCqFI96gXLLX9r8YKYr++TB\n8CKvBinXz/xDBrqtDfOpIxr7in7poawbtIhx/KRWkVtnTnGfLi2Gum7naz4Vrb+u\nf5wsRoxhRG8t87KElnYbgi0E8MT6gn2Dw+EGuhsCgYEAuL7vvJ3AB/kGXbfeomJU\nfnUHVSPRaUPPiegTbQUb/6gP6zlNXwTIuY3rCYFge9ZifYoFf99Cw2u3QUAweaJW\nObTUwtJmGIsIWC5c5Yqp45iobjrCPQIm55iJxu+qsNz05MR4KHX5JEsYFK1ujKC7\nOrpuG4oVqCyJw6K3e0H0Y20CgYA/m1pcFd9P8f8QxAe62s2hKySH/9JFy3SshBk2\nw/AYRklm4t9n1xVBjAaSwOrHxmbWrq0iMbbgWSEdvNKLJpXcUELF5PNm74IGlYeI\nSvWSdlbeDsXWUAySX/rRFIxAtvAQ1UwGj6FCprk3ZRn3B8j9r6s/2uh8NHGse1be\nVxZB4QKBgQCjMAn8Y7ENhoYlQW5p/xohHvnWsILJ+BBrBd+Cs5Qb+N4KOxmAwhDI\nKMqGsd2TfP71NNwSd1SgINvFdZjZ/KwOq3G3fSfQZBTc/H4frFeUuif4QFBGT/7d\nOOpS9vmRgZTaHcKfABwIlehJUmbwJ47tkrTO2WhoG/c3m2FCzny8ow==\n-----END RSA PRIVATE KEY-----',
};

